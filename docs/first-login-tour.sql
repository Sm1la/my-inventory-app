-- One saved acknowledgement per signed-in account and guide version.
create table public.user_guide_progress (
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 guide_version text not null check (guide_version='office-stock-v1'),
 outcome text not null check (outcome in ('completed','skipped')),
 acknowledged_at timestamptz not null default now(),
 primary key(user_id,guide_version)
);
alter table public.user_guide_progress enable row level security;
revoke all on public.user_guide_progress from anon,authenticated;
grant select,insert on public.user_guide_progress to authenticated;
create policy guide_read_own on public.user_guide_progress for select to authenticated
 using (user_id=(select auth.uid()) and (select inventory_private.active_account()));
create policy guide_acknowledge_own on public.user_guide_progress for insert to authenticated
 with check (user_id=(select auth.uid()) and (select inventory_private.active_account()));
