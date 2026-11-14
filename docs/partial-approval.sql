-- Preserve requested quantities and issue only the quantity actually approved.
alter table public.supply_requests add column approved_quantity integer;
update public.supply_requests set approved_quantity=case when status in ('Approved','Fulfilled') then quantity when status='Rejected' then 0 else null end;
alter table public.supply_requests add constraint supply_request_approved_quantity_check check(
 (status='Pending' and approved_quantity is null) or
 (status='Rejected' and approved_quantity is not null and approved_quantity=0) or
 (status in ('Approved','Fulfilled') and approved_quantity is not null and approved_quantity between 1 and quantity));
CREATE OR REPLACE FUNCTION public.enforce_supply_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if tg_op='INSERT' then
   if new.status<>'Pending' or new.decided_by is not null or new.decided_at is not null or new.resolved_at is not null or new.approved_quantity is not null then
     raise exception 'New requests must start pending approval';
   end if;
   return new;
 end if;
 if new.workspace_id<>old.workspace_id or new.id<>old.id then raise exception 'Request identity cannot change'; end if;
 if new.approved_quantity is distinct from old.approved_quantity and not (old.status='Pending' and new.status in ('Approved','Rejected')) then
   raise exception 'Approved quantity cannot change after a decision';
 end if;
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
   if new.status='Approved' then
     new.approved_quantity:=coalesce(new.approved_quantity,old.quantity);
     if new.approved_quantity not between 1 and old.quantity then raise exception 'Approved quantity must be between 1 and the requested quantity'; end if;
     if new.approved_quantity<old.quantity and length(btrim(new.approval_note))=0 then raise exception 'Enter a reason for approving fewer items'; end if;
   else new.approved_quantity:=0;
   end if;
   new.decided_by := public.inventory_access();
   new.assigned_approver := coalesce(old.assigned_approver,new.decided_by);
   if new.status='Rejected' and length(trim(new.approval_note))=0 then raise exception 'Enter a rejection reason'; end if;
   new.decided_at := now();
   new.resolved_at := case when new.status='Rejected' then now() else null end;
 elsif old.status='Approved' and new.status='Fulfilled' then
   if old.item_id is null then raise exception 'Add this Other item to inventory before fulfilment'; end if;
   if row(new.assigned_approver,new.decided_by,new.decided_at,new.approval_note) is distinct from row(old.assigned_approver,old.decided_by,old.decided_at,old.approval_note) then raise exception 'Approval record cannot change'; end if;
   insert into public.stock_transactions(item_id,kind,quantity,requestor,department,notes)
     values(old.item_id,'issued',old.approved_quantity,old.requestor,old.department,'Approved by ' || old.decided_by || '. Approved ' || old.approved_quantity || ' of ' || old.quantity || ' requested. ' || case when old.requested_colour<>'' then 'Requested colour: ' || old.requested_colour || '. ' else '' end || 'Supply request: ' || old.notes);
   new.resolved_at := now();
 elsif new.status is distinct from old.status then
   raise exception 'Request must be approved before fulfilment; completed decisions cannot be changed';
 elsif row(new.assigned_approver,new.decided_by,new.decided_at,new.approval_note,new.resolved_at) is distinct from row(old.assigned_approver,old.decided_by,old.decided_at,old.approval_note,old.resolved_at) then
   raise exception 'Use the approval action to record a decision';
 end if;
 return new;
end $function$;

create function public.record_supply_approval_quantities(decisions jsonb,decision_note text default '')
returns integer language plpgsql security invoker set search_path='' as $$
declare actor text:=public.inventory_access(); ids uuid[]; expected integer; found_count integer; changed integer;
begin
 if actor is null then raise exception 'Only Maznah, Ira or Sharmila can approve requests'; end if;
 if decisions is null or jsonb_typeof(decisions)<>'array' or jsonb_array_length(decisions) not between 1 and 5000 then raise exception 'Select between 1 and 5000 requests'; end if;
 if exists(select 1 from jsonb_array_elements(decisions) x where jsonb_typeof(x)<>'object' or x->>'request_id' is null or x->>'approved_quantity' is null or (x->>'approved_quantity')!~'^[0-9]{1,8}$') then raise exception 'Each request needs a whole approved quantity, zero or more'; end if;
 select array_agg((x->>'request_id')::uuid) into ids from jsonb_array_elements(decisions) x;
 expected:=cardinality(ids);
 if (select count(distinct id) from unnest(ids) q(id))<>expected then raise exception 'Duplicate request IDs'; end if;
 if length(coalesce(decision_note,''))>500 then raise exception 'Reason must be 500 characters or fewer'; end if;
 perform id from public.supply_requests where id=any(ids) order by id for update;
 select count(*) into found_count from public.supply_requests where id=any(ids) and status='Pending';
 if found_count<>expected then raise exception 'One or more requests are unavailable or already decided. Refresh and try again.'; end if;
 if exists(select 1 from jsonb_to_recordset(decisions) q(request_id uuid,approved_quantity integer)
 join public.supply_requests r on r.id=q.request_id where q.approved_quantity>r.quantity or q.approved_quantity>10000000) then raise exception 'Approved quantity cannot exceed the requested quantity'; end if;
 if length(btrim(coalesce(decision_note,'')))=0 and exists(select 1 from jsonb_to_recordset(decisions) q(request_id uuid,approved_quantity integer)
 join public.supply_requests r on r.id=q.request_id where q.approved_quantity<r.quantity) then raise exception 'Enter a reason for reduced quantities or rejection'; end if;
 update public.supply_requests r set status=case when q.approved_quantity=0 then 'Rejected' else 'Approved' end,
 approved_quantity=q.approved_quantity,decided_by=actor,approval_note=btrim(coalesce(decision_note,''))
 from jsonb_to_recordset(decisions) q(request_id uuid,approved_quantity integer) where r.id=q.request_id and r.status='Pending';
 get diagnostics changed=row_count;
 if changed<>expected then raise exception 'Requests changed during approval. Refresh and try again.'; end if;
 return changed;
end $$;
revoke all on function public.record_supply_approval_quantities(jsonb,text) from public,anon,authenticated;
grant execute on function public.record_supply_approval_quantities(jsonb,text) to authenticated;
