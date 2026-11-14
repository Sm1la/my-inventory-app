-- Run in the project SQL connection. All fixtures and test sessions roll back.
begin;
insert into auth.sessions(id,user_id) select gen_random_uuid(),id from auth.users where lower(email) in ('sharmila@selangorproperties.com.my','mandy.lim@selangorproperties.com.my');
do $$
declare manager uuid; staff uuid; manager_session uuid:=gen_random_uuid(); staff_session uuid:=gen_random_uuid();
 item uuid; request uuid; w uuid; object_path text; before_balance integer; after_balance integer;
begin
 select id into manager from auth.users where lower(email)='sharmila@selangorproperties.com.my';
 select id into staff from auth.users where lower(email)='mandy.lim@selangorproperties.com.my';
 if manager is null or staff is null then raise exception 'Test accounts missing'; end if;
 select id into manager_session from auth.sessions where user_id=manager order by created_at desc nulls first limit 1;
 select id into staff_session from auth.sessions where user_id=staff order by created_at desc nulls first limit 1;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',manager,'role','authenticated','session_id',manager_session)::text,true);
 execute 'set local role authenticated';
 w:=public.demo_workspace_id();
 insert into public.inventory_items(name,code,category,unit,opening_stock,minimum_stock)
 values('Temporary tracker test','TEST-'||left(gen_random_uuid()::text,12),'Stationery','pcs',10,1) returning id into item;
 object_path:=w::text||'/'||item::text||'/'||gen_random_uuid()||'.jpg';
 insert into storage.objects(bucket_id,name) values('inventory-photos',object_path);
 update public.inventory_items set photo_path=object_path where id=item;
 begin
   insert into storage.objects(bucket_id,name) values('inventory-photos',gen_random_uuid()::text||'/'||item::text||'/bad.jpg');
   raise exception 'TEST FAILURE: cross-workspace upload accepted';
 exception when insufficient_privilege then null; end;
 insert into public.supply_requests(item_id,quantity,requestor,department,assigned_approver,requester_id)
 values(item,2,'Tracker test','Finance','Mila',staff) returning id into request;
 if (select requester_id from public.supply_requests where id=request)<>manager then raise exception 'Owner spoofing accepted'; end if;
 begin
   perform public.confirm_request_collection(request);
   raise exception 'TEST FAILURE: pending collection accepted';
 exception when raise_exception then if sqlerrm like 'TEST FAILURE:%' then raise; end if; end;
 update public.supply_requests set status='Approved' where id=request;
 perform public.resolve_supply_request(request,'Fulfilled');
 if (select ready_at from public.supply_requests where id=request) is null then raise exception 'Ready time not recorded'; end if;
 select balance into before_balance from public.inventory_balances where id=item;
 if before_balance<>8 then raise exception 'Issue did not deduct exactly two units'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',staff,'role','authenticated','session_id',staff_session)::text,true);
 if public.inventory_access() is not null then raise exception 'Staff unexpectedly has manager access'; end if;
 begin
   insert into storage.objects(bucket_id,name) values('inventory-photos',w::text||'/'||item::text||'/staff.jpg');
   raise exception 'TEST FAILURE: staff photo upload accepted';
 exception when insufficient_privilege then null; end;
 begin
   perform public.confirm_request_collection(request);
   raise exception 'TEST FAILURE: another account collected the request';
 exception when raise_exception then if sqlerrm like 'TEST FAILURE:%' then raise; end if; end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',manager,'role','authenticated','session_id',manager_session)::text,true);
 perform public.confirm_request_collection(request);
 perform public.confirm_request_collection(request);
 if (select collected_by from public.supply_requests where id=request)<>manager then raise exception 'Collector identity not saved'; end if;
 select balance into after_balance from public.inventory_balances where id=item;
 if before_balance<>after_balance then raise exception 'Collection deducted stock again'; end if;
 begin
   update public.supply_requests set requester_id=staff where id=request;
   raise exception 'TEST FAILURE: owner changed';
 exception when raise_exception then if sqlerrm like 'TEST FAILURE:%' then raise; end if; end;
 execute 'reset role';
end $$;
rollback;
select 'Tracker identity, lifecycle, idempotent collection, private photo read and manager-only photo writes passed; fixtures rolled back.' as result;
