-- Optional stationery colour metadata and request colour preference.
alter table public.inventory_items
 add column stationery_type text not null default '' check(stationery_type in ('','Paper','Ball pen','Marker pen')),
 add column colour text not null default '' check(length(colour)<=60),
 add constraint stationery_colour_category check(category='Stationery' or (stationery_type='' and colour=''));
alter table public.supply_requests add column requested_colour text not null default '' check(length(requested_colour)<=60);
create or replace view public.inventory_balances with (security_invoker=true) as
 select i.id,i.workspace_id,i.name,i.code,i.category,i.unit,i.opening_stock,i.minimum_stock,i.supplier,i.unit_price,i.location,i.expiry_date,i.created_at,
 coalesce(t.received,0)::integer as received,coalesce(t.issued,0)::integer as issued,
 (i.opening_stock+coalesce(t.received,0)-coalesce(t.issued,0))::integer as balance,
 i.brand,i.weight,i.units_per_box,i.stationery_type,i.colour
 from public.inventory_items i left join (
 select item_id,sum(quantity) filter(where kind='received') as received,sum(quantity) filter(where kind='issued') as issued
 from public.stock_transactions group by item_id
 ) t on t.item_id=i.id;

create or replace function public.enforce_supply_approval() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
 if tg_op='INSERT' then
   if new.status<>'Pending' or new.decided_by is not null or new.decided_at is not null or new.resolved_at is not null then
     raise exception 'New requests must start pending approval';
   end if;
   return new;
 end if;
 if new.workspace_id<>old.workspace_id or new.id<>old.id then raise exception 'Request identity cannot change'; end if;
 if row(new.quantity,new.requestor,new.department,new.notes,new.other_name,new.other_brand,new.other_category,new.requested_colour) is distinct from row(old.quantity,old.requestor,old.department,old.notes,old.other_name,old.other_brand,old.other_category,old.requested_colour) then
   raise exception 'Create a new request to change its details';
 end if;
 if new.item_id is distinct from old.item_id then
   if not (old.item_id is null and new.item_id is not null and public.inventory_access() is not null and old.status in ('Pending','Approved')) then
     raise exception 'Only inventory managers can link an Other request to inventory';
   end if;
   if not exists(select 1 from public.inventory_items where id=new.item_id and workspace_id=new.workspace_id and category=old.other_category) then
     raise exception 'Linked item must match the request category and workspace';
   end if;
 end if;
 if old.status='Pending' and new.status in ('Approved','Rejected') then
   if public.inventory_access() is null then raise exception 'Only Maznah, Ira or Sharmila can approve requests'; end if;
   new.decided_by := public.inventory_access();
   new.assigned_approver := coalesce(old.assigned_approver,new.decided_by);
   if new.status='Rejected' and length(trim(new.approval_note))=0 then raise exception 'Enter a rejection reason'; end if;
   new.decided_at := now();
   new.resolved_at := case when new.status='Rejected' then now() else null end;
 elsif old.status='Approved' and new.status='Fulfilled' then
   if old.item_id is null then raise exception 'Add this Other item to inventory before fulfilment'; end if;
   if row(new.assigned_approver,new.decided_by,new.decided_at,new.approval_note) is distinct from row(old.assigned_approver,old.decided_by,old.decided_at,old.approval_note) then raise exception 'Approval record cannot change'; end if;
   insert into public.stock_transactions(item_id,kind,quantity,requestor,department,notes)
     values(old.item_id,'issued',old.quantity,old.requestor,old.department,'Approved by ' || old.decided_by || '. ' || case when old.requested_colour<>'' then 'Requested colour: ' || old.requested_colour || '. ' else '' end || 'Supply request: ' || old.notes);
   new.resolved_at := now();
 elsif new.status is distinct from old.status then
   raise exception 'Request must be approved before fulfilment; completed decisions cannot be changed';
 elsif row(new.assigned_approver,new.decided_by,new.decided_at,new.approval_note,new.resolved_at) is distinct from row(old.assigned_approver,old.decided_by,old.decided_at,old.approval_note,old.resolved_at) then
   raise exception 'Use the approval action to record a decision';
 end if;
 return new;
end $$;

create or replace function public.add_requested_inventory(p_request_id uuid,p_item jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare r public.supply_requests; new_id uuid;
begin
 if public.inventory_access() is null then raise exception 'Only Maznah, Ira and Mila can add inventory'; end if;
 select * into r from public.supply_requests where id=p_request_id for update;
 if not found then raise exception 'Request not found'; end if;
 if r.item_id is not null then raise exception 'This request is already linked to inventory'; end if;
 if r.status not in ('Pending','Approved') then raise exception 'Only open requests can be added to inventory'; end if;
 insert into public.inventory_items(name,code,category,brand,unit,opening_stock,minimum_stock,supplier,unit_price,location,weight,units_per_box,expiry_date,stationery_type,colour)
 values(btrim(p_item->>'name'),upper(btrim(p_item->>'code')),r.other_category,coalesce(p_item->>'brand',r.other_brand),
 btrim(p_item->>'unit'),(p_item->>'opening_stock')::integer,(p_item->>'minimum_stock')::integer,
 coalesce(p_item->>'supplier',''),coalesce((p_item->>'unit_price')::numeric,0),coalesce(p_item->>'location',''),
 case when r.other_category='Pantry' then nullif(p_item->>'weight','') else null end,
 case when r.other_category='Stationery' then nullif(p_item->>'units_per_box','')::integer else null end,
 nullif(p_item->>'expiry_date','')::date,case when r.other_category='Stationery' then coalesce(p_item->>'stationery_type','') else '' end,case when r.other_category='Stationery' then coalesce(p_item->>'colour',r.requested_colour,'') else '' end) returning id into new_id;
 update public.supply_requests set item_id=new_id where id=r.id;
 return new_id;
end $$;
revoke execute on function public.add_requested_inventory(uuid,jsonb) from public,anon;
grant execute on function public.add_requested_inventory(uuid,jsonb) to authenticated;
