-- Resolve a linked inventory from the signed-in account, before any legacy browser scope.
create table inventory_private.account_workspaces (
 user_id uuid primary key references auth.users(id) on delete cascade,
 workspace_id uuid not null references public.inventory_workspaces(id),
 created_at timestamptz not null default now()
);
alter table inventory_private.account_workspaces enable row level security;
revoke all on inventory_private.account_workspaces from public,anon,authenticated;
grant select on inventory_private.account_workspaces to anon,authenticated;
create policy account_workspace_read_self on inventory_private.account_workspaces
 for select to authenticated using(user_id=(select auth.uid()));

create function public.account_inventory_workspace()
returns uuid language sql stable security invoker set search_path = ''
as $$
 select workspace_id from inventory_private.account_workspaces
 where user_id=(select auth.uid())
$$;
revoke execute on function public.account_inventory_workspace() from public;
grant execute on function public.account_inventory_workspace() to anon,authenticated;

create or replace function public.demo_workspace_id()
returns uuid language sql stable security invoker set search_path = ''
as $$
 select coalesce(
   (select public.account_inventory_workspace()),
   nullif(current_setting('request.headers',true)::json->>'x-workspace-id','')::uuid
 )
$$;
