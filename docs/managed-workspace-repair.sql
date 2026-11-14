-- Restore the shared inventory link for already-authorized managed staff.
insert into inventory_private.account_workspaces(user_id,workspace_id)
select staff.id,w.workspace_id from auth.users staff
join auth.users owner on owner.id::text=staff.raw_app_meta_data->>'inventory_created_by'
join inventory_private.account_workspaces w on w.user_id=owner.id
where lower(owner.email)='sharmila@selangorproperties.com.my'
and owner.deleted_at is null and owner.email_confirmed_at is not null
and staff.deleted_at is null and staff.email_confirmed_at is not null
and lower(staff.email) ~ '^[^@[:space:]]+@selangorproperties[.]com[.]my$'
on conflict(user_id) do nothing;

create or replace function inventory_private.link_managed_account() returns trigger
language plpgsql security definer set search_path='' as $$
declare owner_workspace uuid;
begin
 if new.raw_app_meta_data->>'inventory_created_by' is null then return new; end if;
 select w.workspace_id into owner_workspace from inventory_private.account_workspaces w
 join auth.users u on u.id=w.user_id where u.id::text=new.raw_app_meta_data->>'inventory_created_by'
 and lower(u.email)='sharmila@selangorproperties.com.my' and u.deleted_at is null
 and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<now());
 if owner_workspace is null then raise exception 'Inventory administrator workspace is unavailable'; end if;
 if lower(new.email) !~ '^[^@[:space:]]+@selangorproperties[.]com[.]my$' then raise exception 'Company email required'; end if;
 insert into inventory_private.account_workspaces(user_id,workspace_id) values(new.id,owner_workspace)
 on conflict(user_id) do nothing;
 return new;
end $$;
revoke all on function inventory_private.link_managed_account() from public,anon,authenticated;
drop trigger link_managed_inventory_account on auth.users;
create trigger link_managed_inventory_account after insert or update of raw_app_meta_data on auth.users
for each row execute function inventory_private.link_managed_account();
