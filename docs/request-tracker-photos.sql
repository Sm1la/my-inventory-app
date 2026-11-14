-- Account-linked tracking, collection confirmation, and private item photos.
alter table public.supply_requests
 add column requester_id uuid,
 add column ready_at timestamptz,
 add column collected_at timestamptz,
 add column collected_by uuid;

-- Link exact work emails. The older Sharmila records belong to the known
-- workspace administrator; do not infer any other ownership from display names.
update public.supply_requests r set requester_id=u.id
from auth.users u join inventory_private.account_workspaces w on w.user_id=u.id
where r.workspace_id=w.workspace_id and
 (lower(trim(r.requestor))=lower(u.email) or
 (r.requestor='Sharmila' and lower(u.email)='sharmila@selangorproperties.com.my'));

create function inventory_private.track_supply_identity() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='INSERT' then
   new.requester_id:=auth.uid();
   new.ready_at:=null; new.collected_at:=null; new.collected_by:=null;
   return new;
 end if;
 if new.requester_id is distinct from old.requester_id then raise exception 'Request ownership cannot change'; end if;
 if old.status='Approved' and new.status='Fulfilled' then
   new.ready_at:=now();
 elsif new.ready_at is distinct from old.ready_at then raise exception 'Use fulfilment to mark supplies ready'; end if;
 if row(new.collected_at,new.collected_by) is distinct from row(old.collected_at,old.collected_by) then
   if old.status<>'Fulfilled' or old.collected_at is not null or
      old.requester_id is distinct from auth.uid() or not inventory_private.active_account() then
     raise exception 'Only the signed-in requester can confirm collection after stock is issued';
   end if;
   if (to_jsonb(new)-array['collected_at','collected_by']) is distinct from
      (to_jsonb(old)-array['collected_at','collected_by']) then
     raise exception 'Collection confirmation cannot change request details';
   end if;
   new.collected_at:=now(); new.collected_by:=auth.uid();
 end if;
 return new;
end $$;
revoke all on function inventory_private.track_supply_identity() from public;
create trigger track_supply_identity before insert or update on public.supply_requests
for each row execute function inventory_private.track_supply_identity();

create function public.confirm_request_collection(p_request_id uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare r public.supply_requests;
begin
 if auth.uid() is null or not inventory_private.active_account() then raise exception 'Sign in to confirm collection'; end if;
 select * into r from public.supply_requests where id=p_request_id and requester_id=auth.uid() for update;
 if not found then raise exception 'Your request was not found'; end if;
 if r.status<>'Fulfilled' then raise exception 'Wait for your supplies to be issued'; end if;
 if r.collected_at is not null then return; end if;
 update public.supply_requests set collected_at=now(),collected_by=auth.uid() where id=r.id;
end $$;
revoke all on function public.confirm_request_collection(uuid) from public,anon;
grant execute on function public.confirm_request_collection(uuid) to authenticated;
create index supply_requests_requester_idx on public.supply_requests(workspace_id,requester_id,created_at desc);

alter table public.inventory_items add column photo_path text;
alter table public.inventory_items add constraint item_photo_path_check check
 (photo_path is null or (length(photo_path)<250 and photo_path like workspace_id::text||'/'||id::text||'/%' and photo_path !~ '\.\.'));
create or replace view public.inventory_balances with(security_invoker=true) as
select i.id,i.workspace_id,i.name,i.code,i.category,i.unit,i.opening_stock,i.minimum_stock,
 i.supplier,i.unit_price,i.location,i.expiry_date,i.created_at,
 coalesce(t.received,0)::integer as received,coalesce(t.issued,0)::integer as issued,
 (i.opening_stock+coalesce(t.received,0)-coalesce(t.issued,0))::integer as balance,
 i.brand,i.weight,i.units_per_box,i.stationery_type,i.colour,i.photo_path
from public.inventory_items i left join
 (select item_id,sum(quantity) filter(where kind='received') as received,
 sum(quantity) filter(where kind='issued') as issued from public.stock_transactions group by item_id) t on t.item_id=i.id;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('inventory-photos','inventory-photos',false,5242880,array['image/jpeg','image/png','image/webp']);
create policy inventory_photo_read on storage.objects for select to authenticated using
 (bucket_id='inventory-photos' and inventory_private.active_account()
 and (storage.foldername(objects.name))[1]=(select public.demo_workspace_id())::text);
create policy inventory_photo_upload on storage.objects for insert to authenticated with check
 (bucket_id='inventory-photos' and inventory_private.active_account()
 and (select public.inventory_access()) is not null
 and (storage.foldername(objects.name))[1]=(select public.demo_workspace_id())::text
 and exists(select 1 from public.inventory_items i where i.id::text=(storage.foldername(objects.name))[2]
 and i.workspace_id=(select public.demo_workspace_id())));
create policy inventory_photo_delete on storage.objects for delete to authenticated using
 (bucket_id='inventory-photos' and inventory_private.active_account()
 and (select public.inventory_access()) is not null
 and (storage.foldername(objects.name))[1]=(select public.demo_workspace_id())::text);
