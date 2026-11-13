-- Apply docs/user-management.sql first. Fixtures are rolled back.
begin;
select set_config('test.owner',(select id::text from auth.users where lower(email)='sharmila@selangorproperties.com.my'),true);
select set_config('test.owner_session',(select id::text from auth.sessions where user_id=current_setting('test.owner')::uuid order by created_at desc limit 1),true);
select set_config('test.owner_workspace',(select workspace_id::text from inventory_private.account_workspaces where user_id=current_setting('test.owner')::uuid),true);
do $$ declare result jsonb; fixture uuid:=gen_random_uuid(); begin
 result:=public.restrict_inventory_signup_domain(jsonb_build_object('user',jsonb_build_object('email','staff@selangorproperties.com.my','user_metadata',jsonb_build_object('inventory_created_by',current_setting('test.owner')))));
 if not result ? 'error' then raise exception 'Public signup or metadata spoof accepted'; end if;
 result:=public.restrict_inventory_signup_domain(jsonb_build_object('user',jsonb_build_object('email','staff@selangorproperties.com.my','app_metadata',jsonb_build_object('inventory_created_by',current_setting('test.owner')))));
 if result ? 'error' then raise exception 'Trusted admin account creation denied'; end if;
 result:=public.restrict_inventory_signup_domain(jsonb_build_object('user',jsonb_build_object('email','external@example.com','app_metadata',jsonb_build_object('inventory_created_by',current_setting('test.owner')))));
 if not result ? 'error' then raise exception 'External email accepted'; end if;
 insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data) values(fixture,'fixture-'||left(fixture::text,8)||'@selangorproperties.com.my',now(),jsonb_build_object('inventory_created_by',current_setting('test.owner')));
 if not exists(select 1 from inventory_private.account_workspaces where user_id=fixture and workspace_id=current_setting('test.owner_workspace')::uuid) then raise exception 'Managed user not linked'; end if;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.owner'),'role','authenticated','session_id',current_setting('test.owner_session'))::text,true);
set local role authenticated;
do $$ begin
 if not public.inventory_user_admin_access() then raise exception 'Owner denied'; end if;
 if public.demo_workspace_id()::text<>current_setting('test.owner_workspace') then raise exception 'Owner inventory unavailable'; end if;
 if has_function_privilege('authenticated','public.inventory_admin_revoke_sessions(uuid,uuid)','EXECUTE') then raise exception 'Staff can revoke sessions'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.owner'),'role','authenticated','session_id',gen_random_uuid())::text,true);
 if public.inventory_user_admin_access() or public.demo_workspace_id() is not null then raise exception 'Revoked owner session accepted'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated','email','sharmila@selangorproperties.com.my','user_metadata',jsonb_build_object('role','admin'))::text,true);
 if public.inventory_user_admin_access() then raise exception 'JWT metadata spoof accepted'; end if;
end $$;
reset role;
set local role anon;
select set_config('request.jwt.claims','{}',true);
select set_config('request.headers',jsonb_build_object('x-workspace-id',current_setting('test.owner_workspace'))::text,true);
do $$ begin if public.demo_workspace_id() is not null then raise exception 'Anonymous header reached account inventory'; end if; end $$;
select 'Owner access, signup restrictions, managed workspace and revoked-session checks passed' as result;
rollback;
