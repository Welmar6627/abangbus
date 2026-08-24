-- Resolve actionable application-owned database-advisor findings without
-- changing access rules. PostGIS extension-owned objects are deliberately not
-- altered because the migration role does not own them and moving an installed
-- geospatial extension is unsafe for an established production schema.

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists "public read active trips" on public.trips;
create policy "public read active trips"
  on public.trips for select
  to anon, authenticated
  using (status = 'active' or driver_id = (select auth.uid()));

drop policy if exists "users read own favorites" on public.favorites;
create policy "users read own favorites"
  on public.favorites for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "users write own favorites" on public.favorites;
create policy "users write own favorites"
  on public.favorites for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "users update own favorites" on public.favorites;
create policy "users update own favorites"
  on public.favorites for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "users delete own favorites" on public.favorites;
create policy "users delete own favorites"
  on public.favorites for delete
  to authenticated
  using (user_id = (select auth.uid()));

create index if not exists favorites_stop_id_idx on public.favorites (stop_id);
create index if not exists route_stops_stop_id_idx on public.route_stops (stop_id);
