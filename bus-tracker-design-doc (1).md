# Real-Time Bus Tracker — System Design Document
**v0.1 · MVP-focused · prepared for a zero-budget BSIT capstone/thesis build**

> Working name idea, take it or leave it: **AbangBus** — "abang" is already what people say for waiting on a ride, so the name explains the app in one word. Not load-bearing, change it freely.

---

## 0. The one decision that changes everything

**Don't crowd-source location from passengers first. Start with drivers or conductors.**

Crowd-sourcing from anonymous riders has two problems that reinforce each other:

1. **Cold start** — the app is only useful once enough people are using it, but nobody opens an app that shows zero buses, so nobody joins.
2. **Trust** — you have no way to verify a stranger's phone is actually on the bus, which is exactly the "people will just pretend" problem you already spotted.

Both problems disappear if your *first* data source is a small, semi-known group instead: 10-20 drivers or conductors running a "driver mode" screen that shares GPS only while their trip is active. That's a trust surface you can actually manage (you can literally talk to these people), and it makes the app useful to riders from day one — which is what eventually earns you the rider trust needed to layer in passenger crowd-checkins later as a *supplement*, not your only source of truth.

This mirrors what larger players ended up doing once they had resources: Chalo, one of India's largest bus-tracking apps, now runs by partnering directly with bus operators to fit GPS trackers across their fleets rather than pulling location from rider phones at all. You don't have the budget for hardware trackers yet — but the underlying principle (one or a few *trusted* GPS sources per bus beats thousands of unverified ones) is the same. You're just building the phone-based, ₱0 version of it.

Everything below is designed around this sequencing: **Phase 1 ships with zero anti-spoofing complexity because the trust problem is solved by who's allowed to be a source, not by algorithms.** Algorithms come in Phase 2, once you have both a driver feed to check crowd reports against *and* an actual reason to add crowd data (coverage on routes you don't have a driver for yet).

---

## 1. Problem statement

Riders have no way to know whether a bus is 3 minutes or 2 hours away, so they wait at terminals defensively — arriving early "just in case," which routinely costs them the exact time they were trying to save, and makes them late for work or class when the wait runs long.

**Goal:** show riders the live position of buses on their route and a reasonable ETA, sourced from GPS data shared voluntarily by drivers/conductors (Phase 1) and, later, corroborated by passengers (Phase 2) — without needing the operator to install any hardware.

---

## 2. System architecture

**Two apps, one backend, no custom server to run.**

- **Driver app** — a minimal screen: pick a route, tap "start trip," and the phone shares GPS every ~10 seconds until "end trip" is tapped. That's the entire job.
- **Rider app** — shows a map with live bus markers for the routes/stops the rider cares about. Needs **zero location permission** from the rider just to view buses — that's an important design choice, not just a nice-to-have (more on why in §9).
- **Supabase backend** — Postgres (with the PostGIS extension for geospatial queries), Realtime, Auth, and Edge Functions, all in one free-tier project. This is the one part of your existing stack that isn't just "reuse what you know" — Supabase Realtime is genuinely built for exactly this problem: it listens to Postgres row changes and pushes them to subscribed clients over a websocket automatically. You don't write a websocket server; you write to a table, and every subscribed rider's map updates within roughly a second.
- **Map tiles** — rendered client-side from a tile provider (see §3), not something Supabase handles.

**Data flow in one sentence:** driver app writes a row → Postgres change fires → Realtime pushes it to every rider app subscribed to that route → rider's map marker moves.

---

## 3. Tech stack

| Layer | Pick | Why | Cost |
|---|---|---|---|
| Mobile app (both apps) | **React Native via Expo** | You already know React from the boarding-house project — this is the same mental model (components, hooks, JSX) targeting phones instead of browsers. Expo also means you can build for Android *and* iOS from one codebase without owning a Mac for most of development. | Free |
| Backend | **Supabase** (same project family you already use) | Postgres + PostGIS + Realtime + Auth + Edge Functions bundled. PostGIS specifically gives you real geospatial queries (distance-to-route, nearest-stop) instead of hand-rolled lat/lng math. | Free tier to start (see §11) |
| Maps (MVP) | **`react-native-maps`** | Ships in the default Expo workflow, uses Google Maps rendering on Android / Apple Maps on iOS, "just works" with no special build step. Fastest path to a working map screen. | Free, needs a Google Cloud API key (no charge at this scale) |
| Maps (later, optional) | **MapLibre** (`@maplibre/maplibre-react-native`) | Fully open-source fork of Mapbox, no vendor lock-in, works with free OpenStreetMap-based tile providers. Worth migrating to once you want custom map styling or want off Google's platform entirely — but it needs an Expo "development client" build rather than plain Expo Go, which is extra setup you don't need for an MVP. | Free (rendering) + tile provider's free tier |
| Push notifications | Expo push notifications | Built into Expo, no separate service to configure. | Free |
| Driver location while backgrounded | **Foreground service, started by the "Start trip" button** — not raw always-on background location | See §9 — this is both simpler to build and dramatically easier to get approved on both app stores. | — |

---

## 4. Data model

Field names below deliberately echo **GTFS-realtime** (the open standard transit agencies worldwide use for live vehicle data — Google Maps, Transit App, etc. all consume it). You're not required to be GTFS-compliant, but modeling your schema after an established standard means you're not reinventing field semantics, and it keeps the door open to exporting a real GTFS-RT feed later if your city or an app like Google Maps ever wants to ingest it.

```sql
-- Enable PostGIS for geospatial types and queries
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
```

**Row-level security sketch** — riders never need an account just to look at the map, and drivers can only write to their own active trip:

```sql
alter table live_positions enable row level security;

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
```

Keep the **service role key** (which bypasses RLS) only inside Edge Functions or your own backend logic — never bundle it into the mobile app. The mobile apps use the public **anon key**, which is safe to ship because RLS is what actually enforces the rules above.

---

## 5. Real-time data flow

1. Driver taps **Start trip** → app creates a row in `trips` (status `active`) and starts a foreground-service location watcher.
2. Every ~10 seconds, the driver app upserts `live_positions` for that trip and appends a row to `position_history`.
3. Supabase Realtime detects the change on `live_positions` (it listens to Postgres's write-ahead log) and pushes the new row to every rider client subscribed to that route's channel — no polling, no custom websocket code.
4. Rider app updates the bus marker position on the map, interpolating smoothly between the last two points so it doesn't visibly "jump" every 10 seconds.
5. ETA is computed client-side or in an Edge Function: remaining distance along the route polyline (via PostGIS `ST_LineLocatePoint`) divided by a recent average speed for that segment (pulled from `position_history`). This is a rough estimate, not real traffic prediction — good enough for an MVP, refine later.
6. Driver taps **End trip** → row in `trips` set to `completed`, `live_positions` row deleted (a bus that stopped broadcasting should disappear from the map, not freeze in place).

---

## 6. Trust & anti-spoofing strategy

You already correctly identified this as the hard part. Here's how to close most of it in layers, cheaply:

**Layer 1 — who's allowed to be a source (Phase 1, does most of the work).**
Only accounts you've marked `role = 'driver'` can write to `live_positions` at all, enforced by the RLS policy above. This alone eliminates the "random person pretends to be on the bus" problem for your MVP, because random people simply have no write access.

**Layer 2 — reject obviously fake GPS (cheap, do this from day one anyway).**
Android sets a flag automatically whenever a location comes from a mock-location app: `location.isMock` on newer Android versions, `location.isFromMockProvider()` on older ones. Check it on every location update and reject/flag anything where it's true — this alone catches the large majority of casual spoofing attempts, since most spoofing apps don't bother hiding the flag. It's not bulletproof (a rooted phone can hide it), which is why you don't rely on it alone.

**Layer 3 — physics-based validation, server-side.** For every incoming ping:
- Reject if implied speed since the last ping exceeds what's physically possible for a city bus (e.g. >100-120 km/h).
- Reject or down-weight if the position is more than ~100-150m from the route's known polyline.
- Reject if GPS accuracy is worse than some threshold (very poor accuracy readings are a common spoofing tell).

A simple scoring function, run in an Edge Function before a ping is trusted enough to broadcast:

```
function scorePing(ping, route, lastPing):
  score = 100
  if ping.is_mock: return 0                                    # hard reject
  if ping.accuracy_m > 50: score -= 30
  if impliedSpeedKmh(ping, lastPing) > 110: score -= 100        # teleport check
  if distanceFromRoute(ping.location, route.path) > 150: score -= 40
  if ping.source == "driver": score += 20                       # trusted source
  return max(score, 0)

# only write/broadcast pings scoring >= 50
```

**Layer 4 — for passenger crowd-checkins specifically (Phase 2 only).**
Don't trust a single anonymous "I'm on this bus" tap. Require 2-3 independent check-ins clustering within the same ~30 seconds and ~50 meters before showing a crowd-confirmed position, and build a lightweight per-user trust score over time (did this person's past check-ins usually match where the bus actually was, per driver data or later corroboration?). New/unproven accounts get low weight until they've built a track record.

**Layer 5 — optional, if you ever get even a little bit of budget.**
A $5-10 Bluetooth Low Energy beacon stuck inside the bus is far cheaper than a GPS tracker + SIM card + data plan. A passenger's check-in that requires the phone to actually *detect that specific beacon* is much harder to fake than GPS alone, since it requires physical proximity to the real bus. This is a nice stretch goal, not something to build now.

**The honest caveat:** no amount of software makes this cryptographically unspoofable — determined attackers with rooted phones can still get through some checks. The goal isn't perfection, it's making casual spoofing pointless and keeping the *default* trusted source (drivers) clean, which is achievable and is what actually matters for an MVP.

---

## 7. Feature roadmap (phased — build in this order)

| Phase | Scope | Notes |
|---|---|---|
| **0 — Pre-work** | Manually ride/walk 1-2 pilot routes and record the polyline + stop locations. Recruit 3-5 pilot drivers you can talk to directly (classmates' relatives, a receptive terminal, one cooperative operator). | This is the part with no code, and it's the part that actually determines whether the project works. Don't skip it or rush it. |
| **1 — MVP** | Driver app (start/stop trip, background-free foreground-service GPS sharing). Rider app: live map for supported routes, straight-line/route-based ETA. No rider accounts needed to just *view* the map. | Ship this to your 3-5 pilot routes before building anything else. |
| **2 — Trust layer** | Passenger "I'm on this bus" check-in. Confidence scoring per the anti-spoof section. Route snapping (map-matching noisy GPS to the known polyline) for cleaner marker movement. | Only makes sense once Phase 1 has real usage to validate against. |
| **3 — Growth** | Push notifications ("bus arriving in 5 min"), favorite routes/stops, offline caching of route/stop data (useful at terminals with poor signal), inferred typical headways from historical data even without an official schedule, multi-language UI (English / Filipino / Bisaya). | |
| **Stretch** | BLE beacon-verified check-ins, community route/stop corrections, gamified trust badges for reliable contributors. | Nice to have, not required for a strong capstone. |

---

## 8. UI/UX design

**Rider app**

- **Home / map** — full-screen map centered on the user (if location is granted) or a default city view. Bus markers on active routes, colored by route. Search bar to jump to a route or stop.
- **Route detail** — list of stops in order, live "next bus in ~X min" per stop, tap a stop to see its location highlighted on the map.
- **Bus detail** (tap a marker) — current speed, last-updated timestamp, a small badge distinguishing "driver-verified" vs. "community-reported" position once Phase 2 exists — this transparency matters more than it sounds like it should, because it lets riders calibrate their own trust in the data instead of the app pretending to be more certain than it is.
- **Favorites/notifications** — saved stops/routes, toggle for arrival alerts.
- **Onboarding** — a plain-language screen explaining *why* the app wants location (only needed if the rider opts into check-ins or "find nearest stop") before the OS permission dialog ever appears. Apps that explain first and ask second get meaningfully higher opt-in rates than apps that just fire the system dialog cold.

**Driver app** — deliberately minimal, since drivers are busy and often not phone-focused while working:

- **Start trip** — pick route + bus code from a short list, one tap to start. Shows a persistent notification ("AbangBus is sharing this bus's location") the whole time it's running — this is both an Android requirement for foreground services and good transparency practice.
- **Active trip** — big, unmissable **End trip** button. Nothing else competing for attention.
- **Settings** — logout, contact/support.

**Shared**

- **Report an issue** — flag a wrong route, a stuck marker, or bad data. Simple text + optional location.
- **About** — what the app does, link to the privacy policy, contact info.

---

## 9. Security considerations

- **Transport**: HTTPS/TLS everywhere — Supabase handles this by default, don't disable it anywhere.
- **Access control**: Row-Level Security as the actual enforcement layer (see §4) — never rely on the client "being nice" and only sending allowed writes.
- **Least privilege**: mobile apps ship only the Supabase anon key; the service-role key (which bypasses RLS) stays server-side in Edge Functions only.
- **Input validation**: reject malformed coordinates, timestamps in the future, or payloads outside expected bounds before they ever hit the database.
- **Rate limiting**: cap how often a single driver account can write (protects against a compromised account spamming fake trips).
- **Location permission scope — build this in from day one, not as an afterthought:**
  - The **rider** app should need **zero** location permission just to view buses. This isn't only a privacy nicety — it also means most of your user base never triggers any location-permission review at all.
  - The **driver** app's location sharing should be built as a **foreground service explicitly started by the "Start trip" button** (a user-initiated action, ended by "End trip"), rather than requesting the broader "allow all the time" background location permission. Both Google Play and Apple's app review are, as of 2026, actively tightening scrutiny on apps requesting persistent background location — Play Console now requires a formal justification declaration (with a video demo) for true background access, while foreground-service location tied to a clear, user-initiated, temporary action is the far smoother approval path and is explicitly one of the patterns both platforms bless. Your use case (share location only while actively driving a shift) fits this pattern naturally — lean into it rather than requesting more than you need.
  - Whichever permission level you use, both stores require a linked, accessible privacy policy and a clear in-app explanation of why location is collected (see §10).
- **Abuse reporting**: a simple in-app "report an issue" (§8) with admin ability to disable an account, so bad actors aren't purely a technical problem you have to out-engineer.

---

## 10. Privacy policy (draft — starting point, not legal advice)

*Written assuming Philippine deployment, referencing the Data Privacy Act of 2012 (RA 10173). This is a solid first draft to work from, not a substitute for an actual review — have this checked (a school legal clinic or a lawyer) before any public launch beyond a closed pilot, especially once you have real users whose data you're responsible for.*

**1. What we collect**
- **Drivers**: precise GPS location, but only while a trip is active (foreground service, visibly indicated by a persistent notification). Basic account info (phone number or email, display name).
- **Riders**: by default, nothing. Viewing live bus locations requires no account and no location permission. If a rider opts into "find nearest stop" or Phase-2 check-ins, we collect location only at the moment of that action.
- **Everyone**: minimal technical data needed for the app to function (device type, app version) for debugging — not for advertising or analytics resale.

**2. What we don't do**
- We do not sell or share location data with advertisers or third parties.
- We do not request background/always-on location from riders under any circumstance.
- We do not use location data for any purpose beyond showing live transit positions and improving route accuracy.

**3. Who can see what**
- Public map view shows a bus's position tied to its route and bus code — not to the driver's personal identity.
- Trip-to-driver identity mapping is visible only to admins, for accountability purposes (e.g. investigating a reported issue).
- Passenger check-ins (Phase 2) are shown in aggregate/anonymized form publicly; the underlying user ID is retained only for abuse prevention.

**4. Retention**
- Live position data is retained only while a trip is active or recently completed.
- Historical breadcrumb data (`position_history`) is kept for a limited period (e.g. 90 days) to support ETA accuracy and service-quality analysis, then aggregated or deleted.

**5. Your rights (RA 10173)**
You have the right to access, correct, and request deletion of your personal data, and to object to or withdraw consent for processing. Contact: **[insert contact email]**.

**6. Security**
Data is encrypted in transit (HTTPS/TLS). Access to raw data is restricted by row-level security and limited to what each role needs.

**7. Children**
This app is not directed at children and does not knowingly collect data from users under 13.

**8. Changes**
We'll note the effective date of this policy and notify users in-app of material changes.

**9. Contact**
**[insert contact email / developer name]**

---

## 11. Cost breakdown

| Item | Free? | Notes |
|---|---|---|
| Supabase | **Free tier** to start | 500 MB database, 1 GB file storage, 50,000 monthly active users, 200 concurrent Realtime connections, 2 million Realtime messages/month, 500K edge function calls, up to 2 active projects. The one gotcha: free projects auto-pause after 7 days with no traffic — fine during active dev, just remember to poke it if you go quiet for a week. Plenty for a pilot of a handful of routes. |
| React Native / Expo | Free | |
| react-native-maps rendering | Free | Needs a Google Cloud API key (free to create; no charge at pilot-scale usage) |
| MapLibre (if you migrate later) | Free | Rendering is free; still need a tile source (OpenStreetMap-based free tiers, e.g. MapTiler/Stadia Maps, cover small-scale use) |
| GitHub hosting, CI | Free | You're already set up here |
| Android publishing | ~$25 **one-time** (Google Play registration) | Not needed for sideloading APKs to your pilot drivers during testing |
| iOS publishing | **$99/year** (Apple Developer Program) | This is the one real recurring cost, and only hits once you want it on the App Store / TestFlight. Development and Android testing can proceed fully free in the meantime. |
| SMS OTP for driver login | Skip it | Phone-based OTP auth usually requires a paid SMS provider (e.g. Twilio) behind Supabase Auth. With only 10-20 driver accounts, just have an admin create them manually with email/password instead — sidesteps SMS costs entirely at this scale. |

**Bottom line: this is buildable at ₱0 through the entire MVP and pilot phase.** The only unavoidable cash cost is the $99/year Apple fee, and only once you're ready to actually publish to iOS.

---

## 12. Getting started this month

1. Pick **one** route and manually ride it, logging GPS the whole way (even just with a phone) to get a real polyline and stop list — don't wait for "the data" to appear, you're the one creating it.
2. Talk to 3-5 drivers or conductors on that route. You need less buy-in than you think: they just need the app open while they drive.
3. Set up the Supabase project and the schema in §4. This is an afternoon of work given your existing Supabase experience.
4. Build the driver app first — it's the simpler of the two screens, and nothing else works without it.
5. Build the rider map view against real data from your own pilot drivers.
6. Only after that loop works end-to-end: consider Phase 2 (crowd check-ins), notifications, more routes.

---

## 13. Resources worth looking at

- **GTFS-realtime spec** (gtfs.org) — the standard your schema borrows field names from. Useful reference even though you're not required to be compliant.
- **Trufi Association** (trufi-association.org) — a nonprofit that specifically helps cities *without* official transit data build open-source transit apps by mapping routes into OpenStreetMap themselves — including a documented case of a 21-year-old developer building one solo for his hometown when no official data existed. Their core app (Trufi Core) is Flutter-based rather than React Native, so it's more useful to you as inspiration, a reference implementation, and a community to ask questions in than as a direct fork — but it's directly relevant prior art for exactly your situation, including an existing pattern for a driver-facing companion app.
- **Android mock-location detection** (`location.isMock` / `isFromMockProvider`) — Android developer docs.
- **Google Play "Understanding location in the background permissions"** and **Apple's location permission guidelines** — read both before you build the driver app's location logic, not after.
