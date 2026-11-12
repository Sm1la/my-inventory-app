begin;
select set_config('test.owner',(select id::text from auth.users where lower(email)='sharmila@selangorproperties.com.my' and email_confirmed_at is not null),true);
select set_config('test.marker','QA batch ' || gen_random_uuid()::text,true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.owner'),'role','authenticated')::text,true);
select set_config('request.jwt.claim.sub',current_setting('test.owner'),true);
set local role authenticated;
do $$
declare first_item uuid; second_item uuid; before_balance bigint; marker text := current_setting('test.marker');
begin
 select id into first_item from public.inventory_items order by name limit 1;
 select id into second_item from public.inventory_items where id<>first_item order by name limit 1;
 if first_item is null or second_item is null then raise exception 'Need two existing items for batch test'; end if;
 select sum(balance) into before_balance from public.inventory_balances;
 insert into public.supply_requests(item_id,quantity,other_name,other_brand,other_category,requestor,department,assigned_approver,notes)
 values(first_item,2,null,'',null,marker,'Finance','Mila','Batch fixture'),
       (second_item,3,null,'',null,marker,'Finance','Mila','Batch fixture'),
       (null,4,'QA batch Other','QA brand','Pantry',marker,'Finance','Mila','Batch fixture');
 if (select count(*) from public.supply_requests where requestor=marker and department='Finance' and assigned_approver='Mila' and status='Pending')<>3 then raise exception 'Batch common details did not persist'; end if;
 if not exists(select 1 from public.supply_requests where requestor=marker and item_id=first_item and quantity=2) or not exists(select 1 from public.supply_requests where requestor=marker and item_id=second_item and quantity=3) then raise exception 'Per-item quantities incorrect'; end if;
 if (select count(*) from public.supply_requests where requestor=marker and item_id is null and other_name='QA batch Other' and other_brand='QA brand' and quantity=4)<>1 then raise exception 'Other request missing'; end if;
 begin
  insert into public.supply_requests(item_id,quantity,requestor,department,assigned_approver)
  values(first_item,1,marker,'Finance','Mila'),(second_item,0,marker,'Finance','Mila');
  raise exception 'Invalid batch unexpectedly accepted';
 exception when check_violation then null; end;
 if (select count(*) from public.supply_requests where requestor=marker)<>3 then raise exception 'Invalid batch saved partial rows'; end if;
 if (select sum(balance) from public.inventory_balances) is distinct from before_balance then raise exception 'Request batch changed stock balances'; end if;
end $$;
select 'PASS: multi-item quantities, shared request details, mixed Other item, atomic rollback for invalid batch and unchanged stock' as result;
rollback;
