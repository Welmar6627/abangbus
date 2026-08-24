-- Precise vehicle locations are operational data, not permanent analytics.
-- Keep enough history for incident review while limiting privacy exposure and
-- unbounded table growth. The scheduled function is private and cannot be
-- invoked through the Data API.

create extension if not exists pg_cron;

-- Supabase may provision this event-trigger helper. Event-trigger functions
-- are not application RPCs and must not be executable by Data API roles.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;

create or replace function private.purge_expired_operational_data()
returns table (positions_deleted bigint, audit_rows_deleted bigint)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_positions_deleted bigint;
  v_audit_rows_deleted bigint;
begin
  delete from public.position_history
  where recorded_at < now() - interval '30 days';
  get diagnostics v_positions_deleted = row_count;

  delete from public.audit_log
  where occurred_at < now() - interval '365 days';
  get diagnostics v_audit_rows_deleted = row_count;

  return query select v_positions_deleted, v_audit_rows_deleted;
end;
$$;

revoke all on function private.purge_expired_operational_data() from public, anon, authenticated;

select cron.schedule(
  'abangbus-operational-data-retention',
  '17 3 * * *',
  $job$select private.purge_expired_operational_data();$job$
);
