-- Any verified inventory approver may decide requests, regardless of assignment.
-- Mila remains the stored legacy label for Sharmila to preserve existing records.
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
     values(old.item_id,'issued',old.quantity,old.requestor,old.department,'Approved by ' || old.decided_by || '. Supply request: ' || old.notes);
   new.resolved_at := now();
 elsif new.status is distinct from old.status then
   raise exception 'Request must be approved before fulfilment; completed decisions cannot be changed';
 elsif row(new.assigned_approver,new.decided_by,new.decided_at,new.approval_note,new.resolved_at) is distinct from row(old.assigned_approver,old.decided_by,old.decided_at,old.approval_note,old.resolved_at) then
   raise exception 'Use the approval action to record a decision';
 end if;
 return new;
end $$;

create or replace function public.record_supply_approvals(request_ids uuid[], decision text, decision_note text default '')
returns integer language plpgsql security invoker set search_path = '' as $$
declare actor text := public.inventory_access(); expected integer; found_count integer; changed integer;
begin
 if actor is null then raise exception 'Only Maznah, Ira or Sharmila can approve requests'; end if;
 if decision is null or decision not in ('Approved','Rejected') then raise exception 'Choose approve or reject'; end if;
 if cardinality(request_ids) is null or cardinality(request_ids) not between 1 and 5000 then raise exception 'Select between 1 and 5000 pending requests'; end if;
 select count(distinct id) into expected from unnest(request_ids) as ids(id);
 if expected <> cardinality(request_ids) then raise exception 'Duplicate or missing request IDs'; end if;
 if length(coalesce(decision_note,''))>500 then raise exception 'Comments must be 500 characters or fewer'; end if;
 if decision='Rejected' and length(btrim(coalesce(decision_note,'')))=0 then raise exception 'Enter a rejection reason'; end if;
 -- Lock in stable order. RLS hides requests from other workspaces.
 perform id from public.supply_requests where id=any(request_ids) order by id for update;
 select count(*) into found_count from public.supply_requests where id=any(request_ids) and status='Pending';
 if found_count<>expected then raise exception 'One or more requests are unavailable or already decided. Refresh and select pending requests again.'; end if;
 update public.supply_requests set status=decision,decided_by=actor,approval_note=btrim(coalesce(decision_note,'')) where id=any(request_ids) and status='Pending';
 get diagnostics changed = row_count;
 if changed<>expected then raise exception 'Requests changed during approval. Refresh and try again.'; end if;
 return changed;
end $$;
revoke all on function public.record_supply_approvals(uuid[],text,text) from public,anon,authenticated;
grant execute on function public.record_supply_approvals(uuid[],text,text) to authenticated;

-- Keep the old single-request endpoint compatible, with identity from Auth.
create or replace function public.record_supply_approval(request_id uuid, decision text, approver_name text, decision_note text default '')
returns void language plpgsql security invoker set search_path = '' as $$
begin
 perform public.record_supply_approvals(array[request_id],decision,decision_note);
end $$;
revoke all on function public.record_supply_approval(uuid,text,text,text) from public,anon;
grant execute on function public.record_supply_approval(uuid,text,text,text) to authenticated;
