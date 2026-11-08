-- Other requests remain requests until a manager adds a real inventory item.
alter table public.supply_requests alter column item_id drop not null;
alter table public.supply_requests
 add column other_name text check(other_name is null or length(btrim(other_name)) between 1 and 120),
 add column other_brand text not null default '' check(length(other_brand)<=120),
 add column other_category text check(other_category in ('Stationery','Pantry')),
 add constraint supply_requests_item_or_other check(item_id is not null or (other_name is not null and other_category is not null));
create index supply_requests_other_queue_idx on public.supply_requests(workspace_id,other_category,created_at) where item_id is null and status in ('Pending','Approved');

create or replace function public.enforce_supply_approval() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
 if tg_op='INSERT' then
   if new.status<>'Pending' or new.decided_by is not null or new.decided_at is not null or new.resolved_at is not null then
     raise exception 'New requests must start pending approval';
   end if;
   return new;
 end if;
 if new.workspace_id<>old.workspace_id or new.id<>old.id then raise exception 'Request identity cannot change'; end if;
 if row(new.quantity,new.requestor,new.department,new.notes,new.other_name,new.other_brand,new.other_category) is distinct from row(old.quantity,old.requestor,old.department,old.notes,old.other_name,old.other_brand,old.other_category) then
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
   if new.decided_by is null or new.decided_by not in ('Maznah','Ira','Mila') then raise exception 'Choose Maznah, Ira or Mila as approver'; end if;
   if old.assigned_approver is not null and new.decided_by<>old.assigned_approver then raise exception 'Decision must be recorded under the assigned approver name'; end if;
   new.assigned_approver := coalesce(old.assigned_approver,new.decided_by);
   if new.status='Rejected' and length(trim(new.approval_note))=0 then raise exception 'Enter a rejection reason'; end if;
   new.decided_at := now();
   new.resolved_at := case when new.status='Rejected' then now() else null end;
 elsif old.status='Approved' and new.status='Fulfilled' then
   if old.item_id is null then raise exception 'Add this Other item to inventory before fulfilment'; end if;
   if row(new.assigned_approver,new.decided_by,new.decided_at,new.approval_note) is distinct from row(old.assigned_approver,old.decided_by,old.decided_at,old.approval_note) then raise exception 'Approval record cannot change'; end if;
   insert into public.stock_transactions(item_id,kind,quantity,requestor,department,notes)
     values(old.item_id,'issued',old.quantity,old.requestor,old.department,'Approved by ' || old.decided_by || '. Supply request: ' || old.notes);
   new.resolved_at := now();
 elsif new.status is distinct from old.status then
   raise exception 'Request must be approved before fulfilment; completed decisions cannot be changed';
 elsif row(new.assigned_approver,new.decided_by,new.decided_at,new.approval_note,new.resolved_at) is distinct from row(old.assigned_approver,old.decided_by,old.decided_at,old.approval_note,old.resolved_at) then
   raise exception 'Use the approval action to record a decision';
 end if;
 return new;
end $$;

create function public.add_requested_inventory(p_request_id uuid,p_item jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare r public.supply_requests; new_id uuid;
begin
 if public.inventory_access() is null then raise exception 'Only Maznah, Ira and Mila can add inventory'; end if;
 select * into r from public.supply_requests where id=p_request_id for update;
 if not found then raise exception 'Request not found'; end if;
 if r.item_id is not null then raise exception 'This request is already linked to inventory'; end if;
 if r.status not in ('Pending','Approved') then raise exception 'Only open requests can be added to inventory'; end if;
 insert into public.inventory_items(name,code,category,brand,unit,opening_stock,minimum_stock,supplier,unit_price,location,weight,units_per_box,expiry_date)
 values(btrim(p_item->>'name'),upper(btrim(p_item->>'code')),r.other_category,coalesce(p_item->>'brand',r.other_brand),
 btrim(p_item->>'unit'),(p_item->>'opening_stock')::integer,(p_item->>'minimum_stock')::integer,
 coalesce(p_item->>'supplier',''),coalesce((p_item->>'unit_price')::numeric,0),coalesce(p_item->>'location',''),
 case when r.other_category='Pantry' then nullif(p_item->>'weight','') else null end,
 case when r.other_category='Stationery' then nullif(p_item->>'units_per_box','')::integer else null end,
 nullif(p_item->>'expiry_date','')::date) returning id into new_id;
 update public.supply_requests set item_id=new_id where id=r.id;
 return new_id;
end $$;
revoke execute on function public.add_requested_inventory(uuid,jsonb) from public,anon;
grant execute on function public.add_requested_inventory(uuid,jsonb) to authenticated;
