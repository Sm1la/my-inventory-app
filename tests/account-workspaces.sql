begin;
select set_config('test.owner',(select id::text from auth.users where lower(email)='sharmila@selangorproperties.com.my' and email_confirmed_at is not null),true);
select set_config('test.expected',(select workspace_id::text from inventory_private.account_workspaces where user_id=current_setting('test.owner')::uuid),true);
select set_config('test.expected_items',(select count(*)::text from public.inventory_items where workspace_id=current_setting('test.expected')::uuid),true);
select set_config('request.headers','{"x-workspace-id":"00000000-0000-0000-0000-000000000000"}',true);
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select set_config('request.jwt.claim.sub','',true);
do $$ begin
 if public.account_inventory_workspace() is not null then raise exception 'Anonymous account mapping exposed'; end if;
 if (select count(*) from inventory_private.account_workspaces)<>0 then raise exception 'Anonymous mappings exposed'; end if;
 if (select count(*) from public.inventory_items)<>0 then raise exception 'Anonymous linked inventory exposed'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated','email','sharmila@selangorproperties.com.my')::text,true);
select set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
do $$ begin
 if public.account_inventory_workspace() is not null then raise exception 'Forged email gained account mapping'; end if;
 if (select count(*) from inventory_private.account_workspaces)<>0 then raise exception 'Other account mapping exposed'; end if;
 if has_table_privilege('inventory_private.account_workspaces','INSERT,UPDATE,DELETE') then raise exception 'Client can change account mappings'; end if;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.owner'),'role','authenticated')::text,true);
select set_config('request.jwt.claim.sub',current_setting('test.owner'),true);
do $$ begin
 if public.account_inventory_workspace()::text is distinct from current_setting('test.expected') then raise exception 'Owner mapping not found'; end if;
 if public.demo_workspace_id()::text is distinct from current_setting('test.expected') then raise exception 'Browser header overrode owner mapping'; end if;
 if (select count(*) from public.inventory_items)<>current_setting('test.expected_items')::integer then raise exception 'Saved inventory did not load'; end if;
 if public.inventory_access() is distinct from 'Mila' then raise exception 'Inventory manager access lost'; end if;
end $$;
select 'PASS: saved inventory follows account, stale browser header ignored, other/anonymous users cannot read or change mappings' as result;
rollback;
