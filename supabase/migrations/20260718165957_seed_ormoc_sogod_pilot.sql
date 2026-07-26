-- Replace Cebu demonstration records with the first AbangBus pilot corridor.
update public.routes set active = false where code <> 'ORMOC-SOGOD';

insert into public.routes (id, code, name, path, color, active)
values (
  '33333333-3333-4333-8333-333333333333',
  'ORMOC-SOGOD',
  'Ormoc - Sogod',
  ST_GeogFromText('LINESTRING(124.6075 11.0106, 124.6300 10.9600, 124.6923 10.9186, 124.7400 10.8200, 124.8000 10.6800, 124.9655 10.6045, 124.9700 10.4900, 124.9800 10.3861)'),
  '#005EA4',
  true
)
on conflict (code) do update
set name = excluded.name,
    path = excluded.path,
    color = excluded.color,
    active = true;

insert into public.stops (id, name, location) values
  ('31000000-0000-4000-8000-000000000001', 'Ormoc City South Terminal', ST_GeogFromText('POINT(124.6075 11.0106)')),
  ('31000000-0000-4000-8000-000000000002', 'Albuera Poblacion', ST_GeogFromText('POINT(124.6923 10.9186)')),
  ('31000000-0000-4000-8000-000000000003', 'Baybay Public Terminal', ST_GeogFromText('POINT(124.8000 10.6800)')),
  ('31000000-0000-4000-8000-000000000004', 'Mahaplag Poblacion', ST_GeogFromText('POINT(124.9655 10.6045)')),
  ('31000000-0000-4000-8000-000000000005', 'Sogod Public Terminal', ST_GeogFromText('POINT(124.9800 10.3861)'))
on conflict (id) do update
set name = excluded.name,
    location = excluded.location;

delete from public.route_stops
where route_id = (select id from public.routes where code = 'ORMOC-SOGOD');

insert into public.route_stops (route_id, stop_id, sequence)
select route.id, stop.stop_id, stop.sequence
from (select id from public.routes where code = 'ORMOC-SOGOD') route
cross join (values
  ('31000000-0000-4000-8000-000000000001'::uuid, 1),
  ('31000000-0000-4000-8000-000000000002'::uuid, 2),
  ('31000000-0000-4000-8000-000000000003'::uuid, 3),
  ('31000000-0000-4000-8000-000000000004'::uuid, 4),
  ('31000000-0000-4000-8000-000000000005'::uuid, 5)
) as stop(stop_id, sequence);
