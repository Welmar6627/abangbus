# AbangBus

AbangBus is an Expo Router application for the Ormoc–Sogod bus pilot. Approved
drivers can start a trip and publish foreground GPS updates; riders can browse
the route, see active buses, and save favorite stops. Supabase provides Auth,
Postgres/PostGIS, Row Level Security, Realtime-ready live positions, and audit
storage.

## Architecture

- `app/` — Expo Router screens and role-specific navigation.
- `components/` — shared branding, navigation, and native/web map adapters.
- `lib/abangbus-data.ts` — domain types, local pilot fallback, ETA/progress math.
- `lib/demo-tracker.ts` — in-memory demo mode used only without Supabase.
- `lib/supabase-auth.ts` — authentication and OAuth gateway.
- `lib/supabase-transit.ts` — transit queries and mutation RPCs.
- `lib/use-session.ts` — one shared app-wide session subscription.
- `lib/use-live-transit.ts` — coalesced Realtime refresh and view state.
- `lib/latest-value-queue.ts` — serialized, latest-value GPS publishing.
- `lib/transit-mappers.ts` — defensive database-to-domain mapping.
- `lib/input-validation.ts` — client-side validation mirrored by database checks.
- `supabase/migrations/` — authoritative schema, RLS, RPC, seed, and audit history.

The mobile/web client contains only a Supabase public/anon key. Authorization is
enforced in Postgres. Driver trip mutations use narrow RPC functions that
re-check the authenticated user and role; UI role checks are usability only.

## Requirements

- Node.js 20 LTS or newer
- npm
- Expo development tooling
- A Supabase project with PostGIS
- Android Studio/Xcode only when producing native builds

## Local setup

1. Install the pinned dependency tree:

   ```powershell
   npm ci
   ```

2. Copy `.env.example` to `.env.local` and set:

   ```text
   EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY
   ```

   These values are public client configuration. Never put a service-role key,
   database password, OAuth client secret, or signing credential in an
   `EXPO_PUBLIC_` variable.

3. Apply migrations in filename order:

   ```powershell
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase migration list
   npx supabase db push --dry-run
   npx supabase db push
   ```

4. Run the checks and start the app:

   ```powershell
   npm run check
   npm start
   ```

Demo mode is available when Supabase variables are blank. It is for local UI
evaluation only and does not persist data.

## Authentication and roles

Email/password and Google OAuth are supported. New accounts always receive the
`passenger` role. After the first administrator is bootstrapped through a
trusted SQL session, administrators should change roles only through the
audited `set_user_role` RPC:

```sql
select public.set_user_role('USER_UUID', 'driver');
```

Configure these items in the Supabase dashboard before production:

- Require email confirmation and enable leaked-password protection.
- Set the minimum password length to at least 8 (12 is recommended).
- Configure CAPTCHA and Auth rate limits for sign-up, password sign-in, password
  reset, and OTP endpoints.
- Keep access-token lifetime short enough for role changes to take effect in an
  acceptable period; revoke sessions when disabling an operator.
- Add `abangbus://reset-password`, `abangbus://login`, and the exact production
  HTTPS equivalents to the redirect allow list. Do not use wildcard production
  redirects.
- Configure an SMTP provider and verify reset/confirmation templates.
- For Google, register the Supabase callback shown in the provider settings.

Supabase Auth events are retained in `auth.audit_log_entries`. Application
trip/role events are retained in append-only `public.audit_log`; only admins can
read it through the Data API, and API roles cannot insert, update, or delete it.

## Database migration safety

`20260726055928_production_security_hardening.sql` intentionally fails if a
driver already has duplicate active trips or if existing rows violate new
integrity constraints. Before production rollout, inspect:

```sql
select driver_id, count(*)
from public.trips
where status = 'active'
group by driver_id
having count(*) > 1;
```

Resolve any result explicitly, take a database backup, run the migration in
staging, run Supabase security/performance advisors, then promote it.

`20260824152522_location_history_retention.sql` adds a daily database job that
purges detailed bus positions after 30 days and application audit records after
365 days. `20260824153005_advisor_hardening.sql` optimizes hot RLS checks and
adds foreign-key lookup indexes. Run `supabase/tests/production_security.sql`
against every promoted environment to verify the API grants and RLS posture.

## Verification

```powershell
npm run check
npm run export:web
npx expo-doctor
```

For a release candidate, also verify on physical Android/iOS devices:

- passenger sign-up, email confirmation, sign-in, sign-out, and password reset;
- guest route browsing and authenticated favorite add/remove;
- passenger denial from driver dispatch;
- driver start, GPS publish, rider visibility, completion, and location stop;
- denial of a second active trip and of writes to another driver's trip;
- admin role change and audit-log visibility;
- offline/poor-GPS errors and app background/foreground behavior.

## Production deployment

1. Use separate Supabase projects for staging and production.
2. Back up production and apply reviewed migrations before shipping the client.
3. Run `npm ci` and `npm run check` in CI; build from the committed lockfile.
4. Build signed native artifacts with EAS or your native CI. Store signing keys
   in the CI secret manager, never in Git.
5. Serve web output only over HTTPS. At the hosting edge, set CSP appropriate to
   the final Supabase origin, `X-Content-Type-Options: nosniff`,
   `Referrer-Policy: strict-origin-when-cross-origin`, a restrictive
   `Permissions-Policy`, and HSTS after HTTPS is confirmed.
6. Restrict Supabase Auth redirects and OAuth origins to exact production URLs.
7. Enable database backups/PITR as appropriate, alert on failed auth and denied
   audit events, and define retention for precise location history.

The repository includes:

- `.github/workflows/quality.yml` for checks, web export, and Android release
  compilation with Java 17;
- `vercel.json` for the web build, SPA routing, HTTPS security headers, and
  restrictive browser permissions;
- `eas.json` for development, preview, and auto-incrementing production builds;
- `docs/PRIVACY.md` and the public `/privacy` route.

Before public launch, replace the operator placeholder in the privacy notice,
publish a monitored privacy/support email, bootstrap the first trusted admin,
verify Supabase Auth settings and redirects, configure crash monitoring, and
complete signed store builds from an authenticated EAS account. These are
release gates, not optional documentation tasks.

Location history is sensitive. Establish a documented retention/deletion policy
and obtain appropriate privacy/legal review before real passenger operations.
