-- Production security hardening.
-- Application clients use narrowly-scoped RPCs for trip mutations. Audit rows are
-- append-only to API roles and contain no tokens, credentials, or location data.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (char_length(action) between 3 and 100),
  resource_type text not null check (char_length(resource_type) between 1 and 60),
  resource_id text,
  result text not null check (result in ('success', 'denied', 'failed')),
  source_ip inet,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint audit_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.audit_log is
  'Append-only application security audit trail. Auth events remain in auth.audit_log_entries.';

alter table public.audit_log enable row level security;
revoke all on table public.audit_log from public, anon, authenticated;
grant select on table public.audit_log to authenticated;

create policy "admins read application audit log"
  on public.audit_log for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'admin'
    )
  );

create index audit_log_occurred_at_idx on public.audit_log (occurred_at desc);
create index audit_log_actor_occurred_idx on public.audit_log (actor_id, occurred_at desc);
create index trips_route_status_idx on public.trips (route_id, status);
create index trips_driver_started_idx on public.trips (driver_id, started_at desc);
create index position_history_trip_recorded_idx on public.position_history (trip_id, recorded_at desc);
create index route_stops_route_sequence_idx on public.route_stops (route_id, sequence);

-- A driver may not accidentally broadcast multiple concurrent trips.
create unique index trips_one_active_per_driver_idx
  on public.trips (driver_id)
  where status = 'active';

alter table public.routes
  alter column active set not null,
  alter column color set not null;

alter table public.trips
  alter column route_id set not null,
  alter column driver_id set not null,
  alter column bus_code set not null,
  add constraint trips_status_valid check (status in ('active', 'completed', 'cancelled')),
  add constraint trips_bus_code_valid check (
    char_length(bus_code) between 2 and 20
    and bus_code ~ '^[A-Z0-9][A-Z0-9 -]*$'
  ),
  add constraint trips_end_state_valid check (
    (status = 'active' and ended_at is null)
    or (status in ('completed', 'cancelled') and ended_at is not null)
  );

alter table public.live_positions
  add constraint live_positions_coordinates_valid check (
    ST_X(location::geometry) between -180 and 180
    and ST_Y(location::geometry) between -90 and 90
  ),
  add constraint live_positions_bearing_valid check (bearing is null or bearing between 0 and 360),
  add constraint live_positions_speed_valid check (speed_mps is null or speed_mps between 0 and 70),
  add constraint live_positions_accuracy_valid check (accuracy_m is null or accuracy_m between 0 and 5000),
  add constraint live_positions_source_valid check (source = 'driver');

alter table public.position_history
  alter column trip_id set not null,
  add constraint position_history_speed_valid check (speed_mps is null or speed_mps between 0 and 70);

alter table public.route_stops
  add constraint route_stops_sequence_valid check (sequence > 0);

create or replace function private.write_audit(
  p_actor_id uuid,
  p_action text,
  p_resource_type text,
  p_resource_id text,
  p_result text default 'success',
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  insert into public.audit_log (
    actor_id, action, resource_type, resource_id, result, source_ip, metadata
  ) values (
    p_actor_id,
    left(p_action, 100),
    left(p_resource_type, 60),
    left(p_resource_id, 200),
    p_result,
    nullif(
      split_part(
        coalesce(nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-forwarded-for', ''),
        ',',
        1
      ),
      ''
    )::inet,
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

revoke all on function private.write_audit(uuid, text, text, text, text, jsonb) from public, anon, authenticated;

create or replace function public.start_trip(p_route_id uuid, p_bus_code text)
returns public.trips
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_actor uuid := auth.uid();
  v_trip public.trips;
  v_bus_code text := upper(trim(p_bus_code));
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = v_actor and role in ('driver', 'admin')
  ) then
    perform private.write_audit(v_actor, 'trip.start', 'trip', null, 'denied', jsonb_build_object('route_id', p_route_id));
    raise exception 'Approved driver role required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.routes where id = p_route_id and active) then
    raise exception 'Active route not found' using errcode = '22023';
  end if;
  if v_bus_code !~ '^[A-Z0-9][A-Z0-9 -]{1,19}$' then
    raise exception 'Bus code must contain 2-20 letters, numbers, spaces, or hyphens' using errcode = '22023';
  end if;

  insert into public.trips (route_id, driver_id, bus_code, status)
  values (p_route_id, v_actor, v_bus_code, 'active')
  returning * into v_trip;

  perform private.write_audit(
    v_actor, 'trip.start', 'trip', v_trip.id::text, 'success',
    jsonb_build_object('route_id', p_route_id, 'bus_code', v_bus_code)
  );
  return v_trip;
end;
$$;

create or replace function public.upsert_live_position(
  p_trip_id uuid,
  p_longitude double precision,
  p_latitude double precision,
  p_bearing numeric default null,
  p_speed_mps numeric default null,
  p_accuracy_m numeric default null,
  p_source text default 'driver',
  p_is_mock boolean default false
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_now timestamptz := now();
begin
  if v_actor is null or not exists (
    select 1
    from public.trips t
    join public.profiles p on p.id = t.driver_id
    where t.id = p_trip_id
      and t.driver_id = v_actor
      and t.status = 'active'
      and p.role in ('driver', 'admin')
  ) then
    raise exception 'Active trip ownership required' using errcode = '42501';
  end if;
  if p_longitude not between -180 and 180 or p_latitude not between -90 and 90
     or (p_bearing is not null and p_bearing not between 0 and 360)
     or (p_speed_mps is not null and p_speed_mps not between 0 and 70)
     or (p_accuracy_m is not null and p_accuracy_m not between 0 and 5000)
     or p_source <> 'driver' then
    raise exception 'Invalid location payload' using errcode = '22023';
  end if;

  insert into public.live_positions (
    trip_id, location, bearing, speed_mps, accuracy_m, source, is_mock, recorded_at
  ) values (
    p_trip_id,
    ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography,
    p_bearing, p_speed_mps, p_accuracy_m, 'driver', p_is_mock, v_now
  )
  on conflict (trip_id) do update set
    location = excluded.location,
    bearing = excluded.bearing,
    speed_mps = excluded.speed_mps,
    accuracy_m = excluded.accuracy_m,
    source = excluded.source,
    is_mock = excluded.is_mock,
    recorded_at = excluded.recorded_at;

  insert into public.position_history (trip_id, location, speed_mps, recorded_at)
  values (
    p_trip_id,
    ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography,
    p_speed_mps,
    v_now
  );
end;
$$;

create or replace function public.complete_trip(p_trip_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_actor uuid := auth.uid();
begin
  update public.trips
  set status = 'completed', ended_at = now()
  where id = p_trip_id and driver_id = v_actor and status = 'active';

  if not found then
    perform private.write_audit(v_actor, 'trip.complete', 'trip', p_trip_id::text, 'denied');
    raise exception 'Active trip ownership required' using errcode = '42501';
  end if;

  delete from public.live_positions where trip_id = p_trip_id;
  perform private.write_audit(v_actor, 'trip.complete', 'trip', p_trip_id::text, 'success');
end;
$$;

create or replace function public.set_user_role(p_user_id uuid, p_role public.user_role)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_actor uuid := auth.uid();
  v_previous public.user_role;
begin
  if not exists (
    select 1 from public.profiles where id = v_actor and role = 'admin'
  ) then
    perform private.write_audit(v_actor, 'profile.role_change', 'profile', p_user_id::text, 'denied');
    raise exception 'Administrator role required' using errcode = '42501';
  end if;

  select role into v_previous from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;

  update public.profiles set role = p_role where id = p_user_id;
  perform private.write_audit(
    v_actor, 'profile.role_change', 'profile', p_user_id::text, 'success',
    jsonb_build_object('previous_role', v_previous, 'new_role', p_role)
  );
end;
$$;

revoke insert, update, delete on public.trips from anon, authenticated;
revoke insert, update, delete on public.live_positions from anon, authenticated;
revoke all on public.position_history from anon, authenticated;
revoke execute on function public.start_trip(uuid, text) from public, anon;
revoke execute on function public.upsert_live_position(uuid, double precision, double precision, numeric, numeric, numeric, text, boolean) from public, anon;
revoke execute on function public.complete_trip(uuid) from public, anon;
revoke execute on function public.set_user_role(uuid, public.user_role) from public, anon;
grant execute on function public.start_trip(uuid, text) to authenticated;
grant execute on function public.upsert_live_position(uuid, double precision, double precision, numeric, numeric, numeric, text, boolean) to authenticated;
grant execute on function public.complete_trip(uuid) to authenticated;
grant execute on function public.set_user_role(uuid, public.user_role) to authenticated;

-- Check-ins are not part of the production pilot. Keep the dormant table inaccessible.
revoke all on public.checkins from public, anon, authenticated;
