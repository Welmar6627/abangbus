-- Driver authorization must be enforced by Postgres, not only by the app UI.
-- New signups remain passengers. An administrator promotes vetted operators.

revoke update on table public.profiles from anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (display_name, phone) on table public.profiles to authenticated;

grant select on table public.routes, public.stops, public.route_stops, public.trips, public.live_positions to anon, authenticated;
grant insert, update, delete on table public.trips, public.live_positions to authenticated;
grant insert on table public.position_history to authenticated;
grant select, insert, update, delete on table public.favorites to authenticated;
grant execute on function public.upsert_live_position(uuid, double precision, double precision, numeric, numeric, numeric, text, boolean) to authenticated;
grant execute on function public.complete_trip(uuid) to authenticated;

drop policy if exists "users read own profile" on public.profiles;
create policy "users read own profile"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

drop policy if exists "driver inserts own trips" on public.trips;
create policy "approved drivers insert own trips"
  on public.trips for insert
  to authenticated
  with check (
    driver_id = (select auth.uid())
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role in ('driver', 'admin')
    )
  );

drop policy if exists "driver updates own trips" on public.trips;
create policy "approved drivers update own trips"
  on public.trips for update
  to authenticated
  using (
    driver_id = (select auth.uid())
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role in ('driver', 'admin')
    )
  )
  with check (
    driver_id = (select auth.uid())
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role in ('driver', 'admin')
    )
  );

drop policy if exists "driver deletes own trips" on public.trips;
create policy "approved drivers delete own trips"
  on public.trips for delete
  to authenticated
  using (
    driver_id = (select auth.uid())
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role in ('driver', 'admin')
    )
  );

drop policy if exists "driver writes own active trip" on public.live_positions;
create policy "approved drivers write own active trip"
  on public.live_positions for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.trips
      join public.profiles on profiles.id = trips.driver_id
      where trips.id = trip_id
        and trips.driver_id = (select auth.uid())
        and trips.status = 'active'
        and profiles.role in ('driver', 'admin')
    )
  );

drop policy if exists "driver updates own active trip" on public.live_positions;
create policy "approved drivers update own active trip"
  on public.live_positions for update
  to authenticated
  using (
    exists (
      select 1
      from public.trips
      join public.profiles on profiles.id = trips.driver_id
      where trips.id = trip_id
        and trips.driver_id = (select auth.uid())
        and trips.status = 'active'
        and profiles.role in ('driver', 'admin')
    )
  )
  with check (
    exists (
      select 1
      from public.trips
      join public.profiles on profiles.id = trips.driver_id
      where trips.id = trip_id
        and trips.driver_id = (select auth.uid())
        and trips.status = 'active'
        and profiles.role in ('driver', 'admin')
    )
  );

drop policy if exists "driver deletes own active trip" on public.live_positions;
create policy "approved drivers delete own active trip"
  on public.live_positions for delete
  to authenticated
  using (
    exists (
      select 1
      from public.trips
      join public.profiles on profiles.id = trips.driver_id
      where trips.id = trip_id
        and trips.driver_id = (select auth.uid())
        and profiles.role in ('driver', 'admin')
    )
  );

drop policy if exists "driver writes position history" on public.position_history;
create policy "approved drivers write position history"
  on public.position_history for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.trips
      join public.profiles on profiles.id = trips.driver_id
      where trips.id = trip_id
        and trips.driver_id = (select auth.uid())
        and profiles.role in ('driver', 'admin')
    )
  );
