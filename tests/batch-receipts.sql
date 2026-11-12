begin;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from auth.users where lower(email)='sharmila@selangorproperties.com.my'),'role','authenticated')::text,true);
set local role authenticated;
do $$
declare a uuid; b uuid; before_a integer; before_b integer; before_count integer; denied boolean;
begin
 select id,balance into a,before_a from public.inventory_balances where category='Stationery' order by id limit 1;
 select id,balance into b,before_b from public.inventory_balances where category='Pantry' order by id limit 1;
 if a is null or b is null then raise exception 'Receipt fixtures require both categories'; end if;
 insert into public.stock_transactions(item_id,kind,quantity,transaction_date,requestor,notes) values
 (a,'received',2,current_date-1,'Receipt integration test','Batch receipt fixture'),
 (b,'received',3,current_date-1,'Receipt integration test','Batch receipt fixture');
 if (select balance from public.inventory_balances where id=a)<>before_a+2 or (select balance from public.inventory_balances where id=b)<>before_b+3 then raise exception 'Batch receipt balances incorrect'; end if;
 if (select count(*) from public.stock_transactions where notes='Batch receipt fixture' and transaction_date=current_date-1)<>2 then raise exception 'Receipt dates incorrect'; end if;
 select count(*) into before_count from public.stock_transactions;
 denied:=false;
 begin
   insert into public.stock_transactions(item_id,kind,quantity,transaction_date,requestor,notes) values
   (a,'received',5,current_date,'Receipt integration test','Invalid receipt fixture'),
   (b,'received',0,current_date,'Receipt integration test','Invalid receipt fixture');
 exception when check_violation then denied:=true;
 end;
 if not denied or (select count(*) from public.stock_transactions)<>before_count or (select balance from public.inventory_balances where id=a)<>before_a+2 then raise exception 'Invalid receipt partially saved'; end if;
 perform set_config('request.headers',jsonb_build_object('x-workspace-id',public.demo_workspace_id())::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
 denied:=false;
 begin insert into public.stock_transactions(item_id,kind,quantity) values(a,'received',1); exception when insufficient_privilege or raise_exception then denied:=true; end;
 if not denied then raise exception 'Unauthorized receipt accepted'; end if;
end $$;
select 'Batch receipts passed: quantities, date, atomicity and manager access; rolled back' as result;
rollback;
