# AbangBus

AbangBus is a React Native + Expo bus tracker for a capstone-style pilot.

## What it does

- Driver mode for starting a trip and sharing live position
- Rider mode for viewing live buses on a route map
- Route detail screens with stop lists and saved favorites
- Supabase-backed auth and live writes when the project is configured

## Tech Stack

- Expo Router
- React Native
- Supabase
- PostGIS

## Local Setup

1. Install dependencies.
2. Copy `.env.example` to `.env.local`.
3. Set these values:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
4. Start the app with Expo.

## Supabase

Use the migration in `supabase/migrations/001_initial_schema.sql` to create the schema, auth trigger, row-level security policies, and helper RPCs.

## Notes

- Keep the `service_role` key out of the mobile app.
- Riders can browse the map without location permission.
- Driver location sharing is intended to be temporary and trip-based.
