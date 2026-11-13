-- Administrator identity comes from Auth, never editable profile/JWT metadata.
create function inventory_private.active_account() returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from auth.users u where u.id=(select auth.uid())
 and u.deleted_at is null and u.email_confirmed_at is not null
 and (u.banned_until is null or u.banned_until<now())
 and exists(select 1 from auth.sessions s where s.user_id=u.id and s.id::text=(select auth.jwt()->>'session_id')))
$$;
revoke all on function inventory_private.active_account() from public,anon,authenticated;
grant execute on function inventory_private.active_account() to anon,authenticated;

create function inventory_private.is_user_admin() returns boolean
language sql stable security definer set search_path = '' as $$
 select inventory_private.active_account() and exists(select 1 from auth.users
 where id=(select auth.uid()) and lower(email)='sharmila@selangorproperties.com.my')
$$;
revoke all on function inventory_private.is_user_admin() from public,anon,authenticated;
grant execute on function inventory_private.is_user_admin() to authenticated;
create function public.inventory_user_admin_access() returns boolean
language sql stable security invoker set search_path = '' as $$ select inventory_private.is_user_admin() $$;
revoke all on function public.inventory_user_admin_access() from public,anon;
grant execute on function public.inventory_user_admin_access() to authenticated;

-- Before User Created hook: service-only app metadata is set by the protected
-- administrator endpoint. Public signUp cannot set app_metadata.
create or replace function public.restrict_inventory_signup_domain(event jsonb)
returns jsonb language sql stable security invoker set search_path = '' as $$
 select case when lower(btrim(coalesce(event->'user'->>'email',''))) ~ '^[^@[:space:]]+@selangorproperties[.]com[.]my$'
 and exists(select 1 from auth.users u where u.id::text=event->'user'->'app_metadata'->>'inventory_created_by'
 and lower(u.email)='sharmila@selangorproperties.com.my' and u.email_confirmed_at is not null
 and u.deleted_at is null and (u.banned_until is null or u.banned_until<now()))
 then '{}'::jsonb else jsonb_build_object('error',jsonb_build_object('http_code',403,
 'message','Only Sharmila can create accounts. Kindly email your ID to sharmila@selangorproperties.com.my for verification')) end
$$;
revoke all on function public.restrict_inventory_signup_domain(jsonb) from public,anon,authenticated;
grant execute on function public.restrict_inventory_signup_domain(jsonb) to supabase_auth_admin;

-- New managed accounts join the owner's existing inventory atomically with Auth creation.
create function inventory_private.link_managed_account() returns trigger
language plpgsql security definer set search_path = '' as $$
declare owner_workspace uuid;
begin
 if new.raw_app_meta_data->>'inventory_created_by' is null then return new; end if;
 select w.workspace_id into owner_workspace from inventory_private.account_workspaces w
 join auth.users u on u.id=w.user_id where u.id::text=new.raw_app_meta_data->>'inventory_created_by'
 and lower(u.email)='sharmila@selangorproperties.com.my' and u.deleted_at is null
 and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<now());
 if owner_workspace is null then raise exception 'Inventory administrator workspace is unavailable'; end if;
 if lower(new.email) !~ '^[^@[:space:]]+@selangorproperties[.]com[.]my$' then raise exception 'Company email required'; end if;
 insert into inventory_private.account_workspaces(user_id,workspace_id) values(new.id,owner_workspace);
 return new;
end $$;
revoke all on function inventory_private.link_managed_account() from public,anon,authenticated;
create trigger link_managed_inventory_account after insert on auth.users
for each row execute function inventory_private.link_managed_account();

-- Deny revoked/deleted accounts, and prevent anonymous browser headers from
-- accessing an inventory attached to real staff accounts.
create function inventory_private.resolve_inventory_workspace() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare workspace uuid;
begin
 if auth.uid() is not null then
   if not inventory_private.active_account() then return null; end if;
   select workspace_id into workspace from inventory_private.account_workspaces where user_id=auth.uid();
   if workspace is not null then return workspace; end if;
 end if;
 begin workspace:=nullif(current_setting('request.headers',true)::json->>'x-workspace-id','')::uuid;
 exception when invalid_text_representation then return null; end;
 if exists(select 1 from inventory_private.account_workspaces where workspace_id=workspace) then return null; end if;
 return workspace;
end $$;
revoke all on function inventory_private.resolve_inventory_workspace() from public,anon,authenticated;
grant execute on function inventory_private.resolve_inventory_workspace() to anon,authenticated;
create or replace function public.demo_workspace_id() returns uuid
language sql stable security invoker set search_path = '' as $$ select inventory_private.resolve_inventory_workspace() $$;

-- Only the Edge Function's service client can call session revocation.
create function inventory_private.revoke_managed_sessions(actor_id uuid,target_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if (select auth.role())<>'service_role' then raise exception 'Service access required'; end if;
 if not exists(select 1 from auth.users where id=actor_id and lower(email)='sharmila@selangorproperties.com.my'
 and deleted_at is null and email_confirmed_at is not null and (banned_until is null or banned_until<now())) then raise exception 'Administrator required'; end if;
 if target_id=actor_id or exists(select 1 from auth.users where id=target_id and lower(email)='sharmila@selangorproperties.com.my') then raise exception 'Administrator account is protected'; end if;
 delete from auth.sessions where user_id=target_id;
end $$;
revoke all on function inventory_private.revoke_managed_sessions(uuid,uuid) from public,anon,authenticated;
grant usage on schema inventory_private to service_role;
grant execute on function inventory_private.revoke_managed_sessions(uuid,uuid) to service_role;
create function public.inventory_admin_revoke_sessions(actor_id uuid,target_id uuid) returns void
language sql security invoker set search_path = '' as $$ select inventory_private.revoke_managed_sessions(actor_id,target_id) $$;
revoke all on function public.inventory_admin_revoke_sessions(uuid,uuid) from public,anon,authenticated;
grant execute on function public.inventory_admin_revoke_sessions(uuid,uuid) to service_role;
