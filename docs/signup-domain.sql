create function public.restrict_inventory_signup_domain(event jsonb)
returns jsonb language sql immutable security invoker set search_path = ''
as $$
  select case
    when lower(btrim(coalesce(event->'user'->>'email',''))) ~ '^[^@[:space:]]+@selangorproperties[.]com[.]my$'
    then '{}'::jsonb
    else jsonb_build_object('error',jsonb_build_object(
      'http_code',403,
      'message','Registration is only available for @selangorproperties.com.my email addresses.'
    ))
  end
$$;
revoke execute on function public.restrict_inventory_signup_domain(jsonb) from public,anon,authenticated;
grant execute on function public.restrict_inventory_signup_domain(jsonb) to supabase_auth_admin;
