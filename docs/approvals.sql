-- Add named request approval without changing existing requests or stock.
alter table public.supply_requests
 add column assigned_approver text check(assigned_approver in ('Maznah','Ira','Mila')),
 add column decided_by text check(decided_by in ('Maznah','Ira','Mila')),
 add column decided_at timestamptz,
 add column approval_note text not null default '' check(length(approval_note)<=500);
alter table public.supply_requests drop constraint supply_requests_status_check;
alter table public.supply_requests add constraint supply_requests_status_check check(status in ('Pending','Approved','Fulfilled','Rejected'));
create index supply_requests_approval_queue_idx on public.supply_requests(workspace_id,assigned_approver,created_at) where status='Pending';

create function public.enforce_supply_approval() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
 if tg_op='INSERT' then
   if new.status<>'Pending' or new.decided_by is not null or new.decided_at is not null or new.resolved_at is not null then
     raise exception 'New requests must start pending approval';
   end if;
   return new;
 end if;
 if new.workspace_id<>old.workspace_id or new.id<>old.id then raise exception 'Request identity cannot change'; end if;
 if row(new.item_id,new.quantity,new.requestor,new.department,new.notes) is distinct from row(old.item_id,old.quantity,old.requestor,old.department,old.notes) then
   raise exception 'Create a new request to change its details';
 end if;
 if old.status='Pending' and new.status in ('Approved','Rejected') then
   if new.decided_by is null or new.decided_by not in ('Maznah','Ira','Mila') then raise exception 'Choose Maznah, Ira or Mila as approver'; end if;
   if old.assigned_approver is not null and new.decided_by<>old.assigned_approver then raise exception 'Decision must be recorded under the assigned approver name'; end if;
   new.assigned_approver := coalesce(old.assigned_approver,new.decided_by);
   if new.status='Rejected' and length(trim(new.approval_note))=0 then raise exception 'Enter a rejection reason'; end if;
   new.decided_at := now();
   new.resolved_at := case when new.status='Rejected' then now() else null end;
 elsif old.status='Approved' and new.status='Fulfilled' then
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
create trigger enforce_supply_approval before insert or update on public.supply_requests for each row execute function public.enforce_supply_approval();

create function public.record_supply_approval(request_id uuid, decision text, approver_name text, decision_note text default '') returns void language plpgsql security invoker set search_path = '' as $$
declare r public.supply_requests;
begin
 if decision is null or decision not in ('Approved','Rejected') then raise exception 'Choose approve or reject'; end if;
 if approver_name is null or approver_name not in ('Maznah','Ira','Mila') then raise exception 'Choose Maznah, Ira or Mila as approver'; end if;
 select * into r from public.supply_requests where id=request_id for update;
 if not found then raise exception 'Request not found'; end if;
 if r.status<>'Pending' then raise exception 'Request already has an approval decision'; end if;
 update public.supply_requests set status=decision,decided_by=approver_name,approval_note=trim(coalesce(decision_note,'')) where id=r.id;
end $$;

create or replace function public.resolve_supply_request(request_id uuid, decision text) returns void language plpgsql security invoker set search_path = '' as $$
declare r public.supply_requests;
begin
 if decision is null or decision<>'Fulfilled' then raise exception 'Record a named approval or rejection in Approvals'; end if;
 select * into r from public.supply_requests where id=request_id for update;
 if not found then raise exception 'Request not found'; end if;
 if r.status<>'Approved' then raise exception 'Request must be approved before fulfilment'; end if;
 -- The trigger records the stock issue atomically, including direct API updates.
 update public.supply_requests set status='Fulfilled' where id=r.id;
end $$;
revoke execute on function public.enforce_supply_approval(),public.record_supply_approval(uuid,text,text,text) from public;
grant execute on function public.enforce_supply_approval(),public.record_supply_approval(uuid,text,text,text) to anon,authenticated;
