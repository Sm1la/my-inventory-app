-- Authorize inventory mutations from confirmed, named Supabase accounts.
create schema if not exists inventory_private;
revoke all on schema inventory_private from public;
grant usage on schema inventory_private to anon,authenticated;

-- A narrowly scoped definer is needed to read the current caller's verified Auth
-- identity without granting clients SELECT on auth.users. No input user ID.
create function inventory_private.manager_name()
returns text language sql stable security definer set search_path = ''
as $$
  select case lower(u.email)
    when 'maznah.bahudin@selangorproperties.com.my' then 'Maznah'
    when 'nazira@selangorproperties.com.my' then 'Ira'
    when 'sharmila@selangorproperties.com.my' then 'Mila'
  end
  from auth.users u
  where u.id = (select auth.uid())
    and (select auth.jwt()->>'role') = 'authenticated'
    and u.email_confirmed_at is not null
    and (u.banned_until is null or u.banned_until < now())
$$;
revoke all on function inventory_private.manager_name() from public,anon,authenticated;
grant execute on function inventory_private.manager_name() to anon,authenticated;

create function public.inventory_access()
returns text language sql stable security invoker set search_path = ''
as $$ select inventory_private.manager_name() $$;
revoke all on function public.inventory_access() from public;
grant execute on function public.inventory_access() to anon,authenticated;

-- Restrictive policies AND with the existing workspace isolation policies.
create policy inventory_managers_insert on public.inventory_items
 as restrictive for insert to anon,authenticated
 with check ((select inventory_private.manager_name()) is not null);
create policy inventory_managers_update on public.inventory_items
 as restrictive for update to anon,authenticated
 using ((select inventory_private.manager_name()) is not null)
 with check ((select inventory_private.manager_name()) is not null);
create policy inventory_managers_delete on public.inventory_items
 as restrictive for delete to anon,authenticated
 using ((select inventory_private.manager_name()) is not null);
create policy inventory_managers_stock on public.stock_transactions
 as restrictive for insert to anon,authenticated
 with check ((select inventory_private.manager_name()) is not null);

-- This public initializer may establish an empty browser workspace, but must
-- never create stock/items on behalf of an unsigned or unauthorized caller.
create or replace function public.initialize_inventory_demo()
returns void language plpgsql security invoker set search_path = ''
as $$
declare w uuid := public.demo_workspace_id();
begin
  if w is null then raise exception 'Workspace header required'; end if;
  perform pg_advisory_xact_lock(hashtext(w::text));
  if exists(select 1 from public.inventory_workspaces where id=w) then return; end if;
  insert into public.inventory_workspaces(id) values(w);
end
$$;
