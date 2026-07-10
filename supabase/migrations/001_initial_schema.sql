
-- Enable PostGIS for geospatial types and queries
create extension if not exists pgcrypto;
create extension if not exists postgis;

create type user_role as enum ('passenger', 'driver', 'admin');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'passenger',
  display_name text,
  phone text,
  created_at timestamptz not null default now()
);

create table routes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,           -- e.g. "04C"
  name text not null,                  -- e.g. "Colon - Talamban"
  path geography(linestring, 4326),    -- route polyline, used for map-matching
  color text default '#1D9E75',
  active boolean default true
);

create table stops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location geography(point, 4326) not null
);

create table route_stops (
  route_id uuid references routes(id) on delete cascade,
  stop_id uuid references stops(id) on delete cascade,
  sequence int not null,
  primary key (route_id, stop_id)
);

create table trips (
  id uuid primary key default gen_random_uuid(),
  route_id uuid references routes(id),
  driver_id uuid references profiles(id),
  bus_code text,                       -- plate number or in-house bus label
  status text not null default 'active',  -- active | completed | cancelled
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

-- One row per ACTIVE trip. This is the fast read path the map subscribes to --
-- keep it small, don't let it grow into a log table.
create table live_positions (
  trip_id uuid primary key references trips(id) on delete cascade,
  location geography(point, 4326) not null,
  bearing numeric,
  speed_mps numeric,
  accuracy_m numeric,
  source text not null default 'driver',   -- driver | passenger_checkin
  is_mock boolean not null default false,
  recorded_at timestamptz not null default now()
);

-- Append-only breadcrumb trail, separate from the live table.
-- Used for ETA calculation and later analytics -- NOT what the map subscribes to.
create table position_history (
  id bigint generated always as identity primary key,
  trip_id uuid references trips(id) on delete cascade,
  location geography(point, 4326) not null,
  speed_mps numeric,
  recorded_at timestamptz not null default now()
);

-- Phase 2: lightweight passenger confirmation ("I'm on this bus")
create table checkins (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references trips(id),
  user_id uuid references profiles(id),
  location geography(point, 4326),
  created_at timestamptz not null default now()
);

create table favorites (
  user_id uuid references profiles(id),
  stop_id uuid references stops(id),
  primary key (user_id, stop_id)
);

alter table profiles enable row level security;
alter table routes enable row level security;
alter table stops enable row level security;
alter table route_stops enable row level security;
alter table trips enable row level security;
alter table live_positions enable row level security;
alter table position_history enable row level security;
alter table checkins enable row level security;
alter table favorites enable row level security;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(coalesce(new.email, ''), '@', 1)),
    'passenger'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create policy "public read routes"
  on routes for select
  using (active = true);

create policy "public read stops"
  on stops for select
  using (true);

create policy "public read route stops"
  on route_stops for select
  using (true);

create policy "users read own profile"
  on profiles for select
  using (auth.uid() = id or exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
  ));

create policy "users update own profile"
  on profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "public read active trips"
  on trips for select
  using (status = 'active' or driver_id = auth.uid());

create policy "driver inserts own trips"
  on trips for insert
  with check (driver_id = auth.uid());

create policy "driver updates own trips"
  on trips for update
  using (driver_id = auth.uid())
  with check (driver_id = auth.uid());

create policy "driver deletes own trips"
  on trips for delete
  using (driver_id = auth.uid());

-- Anyone (including anonymous, unauthenticated requests) can read live positions
create policy "public read live positions"
  on live_positions for select
  using (true);

-- Only the driver assigned to an active trip can write its position
create policy "driver writes own active trip"
  on live_positions for insert
  with check (
    exists (
      select 1 from trips
      where trips.id = trip_id
        and trips.driver_id = auth.uid()
        and trips.status = 'active'
    )
  );

create policy "driver updates own active trip"
  on live_positions for update
  using (
    exists (
      select 1 from trips
      where trips.id = trip_id
        and trips.driver_id = auth.uid()
        and trips.status = 'active'
    )
  );

create policy "driver deletes own active trip"
  on live_positions for delete
  using (
    exists (
      select 1 from trips
      where trips.id = trip_id
        and trips.driver_id = auth.uid()
        and trips.status = 'active'
    )
  );

create policy "driver writes position history"
  on position_history for insert
  with check (
    exists (
      select 1 from trips
      where trips.id = trip_id
        and trips.driver_id = auth.uid()
    )
  );

create policy "users read own favorites"
  on favorites for select
  using (user_id = auth.uid());

create policy "users write own favorites"
  on favorites for insert
  with check (user_id = auth.uid());

create policy "users update own favorites"
  on favorites for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users delete own favorites"
  on favorites for delete
  using (user_id = auth.uid());

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
security invoker
as $$
begin
  insert into live_positions (
    trip_id,
    location,
    bearing,
    speed_mps,
    accuracy_m,
    source,
    is_mock,
    recorded_at
  )
  values (
    p_trip_id,
    ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography,
    p_bearing,
    p_speed_mps,
    p_accuracy_m,
    p_source,
    p_is_mock,
    now()
  )
  on conflict (trip_id) do update
    set location = excluded.location,
        bearing = excluded.bearing,
        speed_mps = excluded.speed_mps,
        accuracy_m = excluded.accuracy_m,
        source = excluded.source,
        is_mock = excluded.is_mock,
        recorded_at = excluded.recorded_at;

  insert into position_history (
    trip_id,
    location,
    speed_mps,
    recorded_at
  )
  values (
    p_trip_id,
    ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography,
    p_speed_mps,
    now()
  );
end;
$$;

create or replace function public.complete_trip(p_trip_id uuid)
returns void
language plpgsql
security invoker
as $$
begin
  update trips
    set status = 'completed',
        ended_at = now()
  where id = p_trip_id and driver_id = auth.uid();

  delete from live_positions where trip_id = p_trip_id;
end;
$$;

-- Insert sample data for testing
insert into routes (id, code, name, path, color) values
(
  '11111111-1111-1111-1111-111111111111',
  '04C',
  'Colon - Talamban',
  ST_GeogFromText('LINESTRING(123.8971 10.2966, 123.9012 10.3047, 123.9048 10.3143, 123.9085 10.3231, 123.9122 10.3324, 123.9159 10.3416, 123.9191 10.3507, 123.9221 10.3602)'),
  '#1D9E75'
),
(
  '22222222-2222-2222-2222-222222222222',
  '06B',
  'Ayala - Lahug',
  ST_GeogFromText('LINESTRING(123.8981 10.3156, 123.9029 10.3181, 123.9074 10.3205, 123.9117 10.3242, 123.9158 10.3279, 123.9192 10.3323, 123.9224 10.3371)'),
  '#2563EB'
);

insert into stops (id, name, location) values
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Colon Street', ST_GeogFromText('POINT(123.8971 10.2966)')),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Sambag / Public Market', ST_GeogFromText('POINT(123.9048 10.3143)')),
('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Talamban Terminal', ST_GeogFromText('POINT(123.9221 10.3602)')),
('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Ayala Center Cebu', ST_GeogFromText('POINT(123.8981 10.3156)')),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Lahug / IT Park', ST_GeogFromText('POINT(123.9158 10.3279)')),
('ffffffff-ffff-ffff-ffff-ffffffffffff', 'Banilad Flyover', ST_GeogFromText('POINT(123.9224 10.3371)'));

insert into route_stops (route_id, stop_id, sequence) values
('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1),
('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 2),
('11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 3),
('22222222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 1),
('22222222-2222-2222-2222-222222222222', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 2),
('22222222-2222-2222-2222-222222222222', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 3);
