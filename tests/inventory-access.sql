begin;
select set_config('test.workspace',gen_random_uuid()::text,true);
select set_config('test.item',gen_random_uuid()::text,true);
select set_config('test.worker',gen_random_uuid()::text,true);
insert into public.inventory_workspaces(id) values(current_setting('test.workspace')::uuid);
insert into public.inventory_items(id,workspace_id,name,code,category,unit,opening_stock)
values(current_setting('test.item')::uuid,current_setting('test.workspace')::uuid,'ACL fixture','ACL-FIXTURE','Stationery','units',10);
do $$
declare r record; uid uuid; identities jsonb := '[]';
begin
 for r in select * from (values
 ('maznah.bahudin@selangorproperties.com.my','Maznah'),
 ('nazira@selangorproperties.com.my','Ira'),
 ('sharmila@selangorproperties.com.my','Mila')) as managers(email,name)
 loop
  select id into uid from auth.users where lower(email)=r.email;
  if uid is null then continue; end if;
  identities := identities || jsonb_build_object('id',uid,'name',r.name);
 end loop;
 perform set_config('test.identities',identities::text,true);
end $$;
select set_config('request.headers',jsonb_build_object('x-workspace-id',current_setting('test.workspace'))::text,true);
set local role authenticated;
do $$
declare r jsonb; new_item uuid; request_id uuid; affected integer;
begin
 for r in select * from jsonb_array_elements(current_setting('test.identities')::jsonb) loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub',r->>'id','role','authenticated')::text,true);
  perform set_config('request.jwt.claim.sub',r->>'id',true);
  if public.inventory_access() is distinct from r->>'name' then raise exception 'Manager identity rejected'; end if;
  insert into public.inventory_items(name,code,category,opening_stock) values('ACL new','ACL-' || (r->>'name'),'Pantry',2) returning id into new_item;
  update public.inventory_items set name='ACL edited' where id=new_item;
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'Manager update rejected'; end if;
  delete from public.inventory_items where id=new_item;
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'Manager delete rejected'; end if;
  perform set_config('request.headers',jsonb_build_object('x-workspace-id',gen_random_uuid())::text,true);
  update public.inventory_items set name='Cross workspace attempt' where id=current_setting('test.item')::uuid;
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'Manager crossed workspace boundary'; end if;
  perform set_config('request.headers',jsonb_build_object('x-workspace-id',current_setting('test.workspace'))::text,true);
  insert into public.stock_transactions(item_id,kind,quantity) values(current_setting('test.item')::uuid,'received',1),(current_setting('test.item')::uuid,'issued',1);
 end loop;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.worker'),'role','authenticated','email','sharmila@selangorproperties.com.my','user_metadata',jsonb_build_object('name','Mila','is_admin',true))::text,true);
 perform set_config('request.jwt.claim.sub',current_setting('test.worker'),true);
 if public.inventory_access() is not null then raise exception 'Spoofed claims escalated worker'; end if;
 if (select count(*) from public.inventory_items)<>1 then raise exception 'Worker read failed'; end if;
 begin
  insert into public.inventory_items(name,code,category) values('Denied','ACL-DENIED','Pantry');
  raise exception 'Worker insert allowed';
 exception when insufficient_privilege then null; end;
 update public.inventory_items set name='Unauthorized' where id=current_setting('test.item')::uuid;
 get diagnostics affected=row_count;
 if affected<>0 then raise exception 'Worker update allowed'; end if;
 delete from public.inventory_items where id=current_setting('test.item')::uuid;
 get diagnostics affected=row_count;
 if affected<>0 then raise exception 'Worker delete allowed'; end if;
 begin
  insert into public.stock_transactions(item_id,kind,quantity) values(current_setting('test.item')::uuid,'received',1);
  raise exception 'Worker receipt allowed';
 exception when insufficient_privilege then null; when raise_exception then
  if sqlerrm<>'Item not found in this workspace' then raise; end if;
 end;
 begin
  insert into public.stock_transactions(item_id,kind,quantity) values(current_setting('test.item')::uuid,'issued',1);
  raise exception 'Worker issue allowed';
 exception when insufficient_privilege then null; when raise_exception then
  if sqlerrm<>'Item not found in this workspace' then raise; end if;
 end;
 insert into public.supply_requests(item_id,quantity,requestor,department,assigned_approver)
 values(current_setting('test.item')::uuid,1,'ACL sample','Finance','Maznah') returning id into request_id;
 perform public.record_supply_approval(request_id,'Approved','Maznah','ACL fixture approval');
 begin
  perform public.resolve_supply_request(request_id,'Fulfilled');
  raise exception 'Worker removed stock through fulfilment';
 exception when insufficient_privilege then null; when raise_exception then
  if sqlerrm<>'Item not found in this workspace' then raise; end if;
 end;
 perform public.initialize_inventory_demo();
 if (select balance from public.inventory_balances where id=current_setting('test.item')::uuid)<>10 then raise exception 'Balance changed during access tests'; end if;
end $$;
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select set_config('request.jwt.claim.sub','',true);
do $$
declare affected integer;
begin
 if public.inventory_access() is not null then raise exception 'Anonymous manager access'; end if;
 begin
  insert into public.inventory_items(name,code,category) values('Denied','ACL-ANON','Pantry');
  raise exception 'Anonymous insert allowed';
 exception when insufficient_privilege then null; end;
 update public.inventory_items set name='Unauthorized';
 get diagnostics affected=row_count;
 if affected<>0 then raise exception 'Anonymous update allowed'; end if;
 delete from public.inventory_items;
 get diagnostics affected=row_count;
 if affected<>0 then raise exception 'Anonymous delete allowed'; end if;
 perform public.initialize_inventory_demo();
 if (select count(*) from public.inventory_items)<>1 then raise exception 'Initializer changed stock'; end if;
 perform set_config('request.headers',jsonb_build_object('x-workspace-id',gen_random_uuid())::text,true);
 perform public.initialize_inventory_demo();
 if (select count(*) from public.inventory_items)<>0 then raise exception 'Initializer bypassed manager permission'; end if;
end $$;
select 'PASS: registered managers can manage items/stock; worker and anonymous writes, metadata spoofing, cross-workspace writes and fulfilment bypass blocked; all fixtures rolled back' as result;
rollback;
