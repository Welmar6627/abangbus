-- Run against a disposable local or staging database after migrations.
-- Each assertion raises an exception when a launch-critical contract drifts.

do $$
declare
  v_missing_rls text[];
begin
  select array_agg(c.relname order by c.relname)
  into v_missing_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and c.relname in (
      'profiles', 'routes', 'stops', 'route_stops', 'trips',
      'live_positions', 'position_history', 'checkins', 'favorites', 'audit_log'
    )
    and not c.relrowsecurity;

  if v_missing_rls is not null then
    raise exception 'RLS missing from: %', v_missing_rls;
  end if;

  if has_table_privilege('anon', 'public.audit_log', 'select')
     or has_table_privilege('anon', 'public.position_history', 'select')
     or has_table_privilege('authenticated', 'public.position_history', 'select') then
    raise exception 'Sensitive history is exposed to a Data API role';
  end if;

  if has_function_privilege('anon', 'public.start_trip(uuid,text)', 'execute')
     or has_function_privilege('anon', 'public.complete_trip(uuid)', 'execute')
     or has_function_privilege('anon', 'public.set_user_role(uuid,public.user_role)', 'execute') then
    raise exception 'Anonymous role can execute a privileged application RPC';
  end if;

  if not has_function_privilege('authenticated', 'public.start_trip(uuid,text)', 'execute')
     or not has_function_privilege('authenticated', 'public.complete_trip(uuid)', 'execute') then
    raise exception 'Authenticated driver RPC grants are missing';
  end if;
end;
$$;

select 'production security assertions passed' as result;
