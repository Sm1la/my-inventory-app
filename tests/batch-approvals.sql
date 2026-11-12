-- Integration test: all fixture rows and decisions roll back.
begin;
select set_config('test.approval_user',(select id::text from auth.users where lower(email)='sharmila@selangorproperties.com.my'),true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.approval_user'),'role','authenticated')::text,true);
select set_config('test.approval_stock',(select coalesce(sum(balance),0)::text from public.inventory_balances where workspace_id=public.demo_workspace_id()),true);
select set_config('test.other_workspace',gen_random_uuid()::text,true);
insert into public.inventory_workspaces(id) values(current_setting('test.other_workspace')::uuid);
insert into public.supply_requests(workspace_id,other_name,other_category,quantity,requestor,department,assigned_approver)
values(current_setting('test.other_workspace')::uuid,'Batch approval isolation fixture','Pantry',1,'Batch approval test','Finance','Maznah');
select set_config('test.foreign_request',(select id::text from public.supply_requests where workspace_id=current_setting('test.other_workspace')::uuid),true);
set local role authenticated;
do $$
declare ids uuid[]; a uuid; b uuid; c uuid; n integer; denied boolean;
begin
 if public.inventory_access()<>'Mila' then raise exception 'Verified test account missing'; end if;
 insert into public.supply_requests(other_name,other_category,quantity,requestor,department,assigned_approver)
 values('Batch test A','Stationery',1,'Batch approval test','Finance','Maznah') returning id into a;
 insert into public.supply_requests(other_name,other_category,quantity,requestor,department,assigned_approver)
 values('Batch test B','Pantry',2,'Batch approval test','Finance','Ira') returning id into b;
 insert into public.supply_requests(other_name,other_category,quantity,requestor,department,assigned_approver)
 values('Batch test C','Pantry',3,'Batch approval test','Finance','Maznah') returning id into c;
 n:=public.record_supply_approvals(array[a,b],'Approved','Batch decision');
 if n<>2 or (select count(*) from public.supply_requests where id=any(array[a,b]) and status='Approved' and decided_by='Mila' and decided_at is not null and approval_note='Batch decision')<>2 then raise exception 'Batch decision or actor incorrect'; end if;
 if (select assigned_approver from public.supply_requests where id=a)<>'Maznah' then raise exception 'Assignment was overwritten'; end if;
 -- Already-decided rows abort the whole batch without approving c.
 denied:=false; begin perform public.record_supply_approvals(array[a,c],'Approved',''); exception when others then denied:=true; end;
 if not denied or (select status from public.supply_requests where id=c)<>'Pending' then raise exception 'Stale batch partially saved'; end if;
 denied:=false; begin perform public.record_supply_approvals(array[c,current_setting('test.foreign_request')::uuid],'Approved',''); exception when others then denied:=true; end;
 if not denied or (select status from public.supply_requests where id=c)<>'Pending' then raise exception 'Cross-workspace batch accepted'; end if;
 denied:=false; begin perform public.record_supply_approvals(array[c,c],'Approved',''); exception when others then denied:=true; end;
 if not denied then raise exception 'Duplicate IDs accepted'; end if;
 denied:=false; begin perform public.record_supply_approvals(array[c],'Rejected','  '); exception when others then denied:=true; end;
 if not denied then raise exception 'Rejection without reason accepted'; end if;
 -- A direct API update cannot impersonate Maznah; actual Auth actor wins.
 update public.supply_requests set status='Rejected',decided_by='Maznah',approval_note='Direct decision' where id=c;
 if (select decided_by from public.supply_requests where id=c)<>'Mila' then raise exception 'Decision identity spoofed'; end if;
 if (select coalesce(sum(balance),0) from public.inventory_balances)<>current_setting('test.approval_stock')::numeric then raise exception 'Approval changed stock'; end if;
 -- An ordinary account claim with manager metadata still cannot decide.
 insert into public.supply_requests(other_name,other_category,quantity,requestor,department,assigned_approver)
 values('Batch unauthorized fixture','Pantry',1,'Batch approval test','Finance','Mila') returning id into a;
 perform set_config('test.pending_request',a::text,true);
 perform set_config('request.headers',jsonb_build_object('x-workspace-id',public.demo_workspace_id())::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated','user_metadata',jsonb_build_object('name','Maznah'))::text,true);
 denied:=false; begin perform public.record_supply_approvals(array[a],'Approved',''); exception when others then denied:=true; end;
 if not denied then raise exception 'Unauthorized RPC approval accepted'; end if;
 denied:=false; begin update public.supply_requests set status='Approved',decided_by='Maznah' where id=a; exception when others then denied:=true; end;
 if not denied then raise exception 'Unauthorized direct approval accepted'; end if;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.approval_user'),'role','authenticated')::text,true);
select 'Batch approval checks passed; all fixtures rolled back' as result;
rollback;
