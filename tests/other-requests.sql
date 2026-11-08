begin;
select set_config('test.workspace',gen_random_uuid()::text,true);
select set_config('test.manager',(select id::text from auth.users where lower(email)='sharmila@selangorproperties.com.my' and email_confirmed_at is not null),true);
select set_config('request.headers',jsonb_build_object('x-workspace-id',current_setting('test.workspace'))::text,true);
insert into public.inventory_workspaces(id) values(current_setting('test.workspace')::uuid);
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select set_config('request.jwt.claim.sub','',true);
do $$
declare rid uuid;
begin
 insert into public.supply_requests(other_name,other_brand,other_category,quantity,requestor,department,assigned_approver)
 values('Other test item','Test Brand','Pantry',4,'Sample requester','Finance','Mila') returning id into rid;
 perform set_config('test.request',rid::text,true);
 if (select count(*) from public.inventory_items)<>0 then raise exception 'Other request created inventory without manager'; end if;
 if not exists(select 1 from public.supply_requests where id=rid and item_id is null and other_name='Other test item' and other_brand='Test Brand' and quantity=4 and status='Pending') then raise exception 'Other request not saved correctly'; end if;
 begin
  insert into public.supply_requests(quantity,requestor,department) values(1,'Sample','Finance');
  raise exception 'Empty Other details accepted';
 exception when check_violation then null; end;
 begin
  perform public.add_requested_inventory(rid,'{}'::jsonb);
  raise exception 'Anonymous inventory conversion allowed';
 exception when insufficient_privilege then null; end;
end $$;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated','email','sharmila@selangorproperties.com.my')::text,true);
select set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
do $$
begin
 begin
  perform public.add_requested_inventory(current_setting('test.request')::uuid,'{}'::jsonb);
  raise exception 'Nonmanager inventory conversion allowed';
 exception when raise_exception then
  if sqlerrm<>'Only Maznah, Ira and Mila can add inventory' then raise; end if;
 end;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.manager'),'role','authenticated')::text,true);
select set_config('request.jwt.claim.sub',current_setting('test.manager'),true);
do $$
declare rid uuid := current_setting('test.request')::uuid; iid uuid; payload jsonb; rejected_id uuid;
begin
 if public.inventory_access()<>'Mila' then raise exception 'Verified manager fixture unavailable'; end if;
 perform public.record_supply_approval(rid,'Approved','Mila','');
 begin
  perform public.resolve_supply_request(rid,'Fulfilled');
  raise exception 'Unlisted request fulfilled without inventory';
 exception when raise_exception then
  if sqlerrm<>'Add this Other item to inventory before fulfilment' then raise; end if;
 end;
 payload := '{"name":"Other test item","code":"TEST-OTHER","brand":"Test Brand","unit":"units","opening_stock":0,"minimum_stock":4,"unit_price":0}'::jsonb;
 perform set_config('request.headers',jsonb_build_object('x-workspace-id',gen_random_uuid())::text,true);
 begin
  perform public.add_requested_inventory(rid,payload);
  raise exception 'Cross-workspace conversion allowed';
 exception when raise_exception then
  if sqlerrm<>'Request not found' then raise; end if;
 end;
 perform set_config('request.headers',jsonb_build_object('x-workspace-id',current_setting('test.workspace'))::text,true);
 iid := public.add_requested_inventory(rid,payload);
 if not exists(select 1 from public.inventory_balances where id=iid and category='Pantry' and brand='Test Brand' and balance=0 and minimum_stock=4) then raise exception 'Inventory conversion failed'; end if;
 if not exists(select 1 from public.supply_requests where id=rid and item_id=iid and status='Approved') then raise exception 'Request linkage failed'; end if;
 begin
  perform public.add_requested_inventory(rid,payload);
  raise exception 'Duplicate conversion allowed';
 exception when raise_exception then
  if sqlerrm<>'This request is already linked to inventory' then raise; end if;
 end;
 if (select count(*) from public.inventory_items)<>1 then raise exception 'Duplicate item created'; end if;
 insert into public.stock_transactions(item_id,kind,quantity) values(iid,'received',4);
 perform public.resolve_supply_request(rid,'Fulfilled');
 if (select balance from public.inventory_balances where id=iid)<>0 then raise exception 'Fulfilment balance incorrect'; end if;
 insert into public.supply_requests(other_name,other_category,quantity,requestor,department,assigned_approver)
 values('Rejected Other','Stationery',1,'Sample','Finance','Mila') returning id into rejected_id;
 perform public.record_supply_approval(rejected_id,'Rejected','Mila','Not needed');
 begin
  perform public.add_requested_inventory(rejected_id,payload);
  raise exception 'Rejected request converted';
 exception when raise_exception then
  if sqlerrm<>'Only open requests can be added to inventory' then raise; end if;
 end;
 if exists(select 1 from public.supply_requests where item_id is null and status in ('Pending','Approved')) then raise exception 'Resolved requests remain in Other reorder queue'; end if;
end $$;
select 'PASS: Other request persistence, no unauthorized inventory creation, approval, manager conversion, duplicate protection, workspace isolation and stock fulfilment' as result;
rollback;
