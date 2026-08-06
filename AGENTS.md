# Race Tracker — Agent Guide

## What this is

A website to easily find races you wish to participate in. The initial focus is **running** (other sports may come later). Anyone can submit races using standard known distances (5K, 10K, Half Marathon, Marathon, 50K, 50 Mile, 100K, 100 Mile) or a custom distance if they wish.

The home page (`/`) is a **dashboard**: signed out it introduces the site and points at Races and Run Clubs; signed in it shows the user's upcoming saved races and the club runs happening in the next week.

The races page (`/races`) shows a table of **25 upcoming races** with a filter bar above it, including:

- Free-text search on race name
- Dates / date range
- Distance
- Location: continent → country selection (ISO 3166-1 alpha-2 codes via the `countries-list` package — the canonical location field is `countryCode`; the `country` display name is always derived from it server-side). State/province granularity may come later (`country-state-city` is the likely library).
- Entry criteria (open registration, closed, ballot, waitlist, invitation, sold out)
- Tags (e.g. World Major, World Major Qualifier)

## Stack (do not deviate without explicit approval)

- **UI**: Next.js (App Router) with Tailwind CSS, in `src/app/`. Components come from **shadcn/ui** (vendored into `src/components/ui/`, configured via `components.json`) — use/add shadcn components rather than hand-rolling styled elements.
- **Database**: Supabase (Postgres), queried through **Prisma** (`src/lib/db/prisma-store.ts`). Supabase-js is now only used for Auth. There is no in-memory fallback store — `DATABASE_URL` is required.
- **Deployment**: Vercel, driven by GitHub Actions (`.github/workflows/deploy.yml`) — build, then migrate, then activate, so the new code never serves against an unmigrated schema. Vercel's own Git auto-deploy is off. Env vars live in the Vercel project and in GitHub Actions secrets, never committed.

## Database rules

- **This app owns a whole Postgres schema, and `public` is off limits.** The Supabase instance is shared with unrelated projects whose tables live in `public` — including their own `races` and `users`. Ours live in a schema of their own (`rt_local` in development, `rt_prod` in production) with plain table names: `races`, `user_races`, `api_keys`, `user_roles`, `run_clubs`. There is no table-name prefix any more; the schema is the boundary. `databaseSchema()` in `src/lib/db/connection.ts` requires `DB_SCHEMA` and rejects `public` outright — do not weaken that.
- **Prisma owns the schema.** Change `prisma/schema.prisma`, then `npm run db:migrate` — never hand-write DDL in the Supabase SQL editor. Full workflow: [prisma/README.md](./prisma/README.md). The old `supabase/migrations/*.sql` files built the abandoned `public.rt_*` tables; they are historical and must not be run or extended.
- **Which schema the tables live in is configuration, not code.** `src/lib/db/connection.ts` is the only place that reads `DB_SCHEMA`. Nothing in `prisma/` may name a schema — no `public.` or `rt_local.` prefixes in migration SQL — or the same migration can no longer build every environment.
- Race and club ids are short 8-char keys (lowercase a–z0–9) generated **by the app server** on create (`generateRaceKey` in `src/lib/db/prisma-store.ts`, collision-retried); the id columns have no DB default.
- RLS is enabled on every table with **no policies**: the backend connects as the database owner (which bypasses RLS), so nothing reached through PostgREST or an anon key can touch them. Prisma cannot express RLS, so **a new table must add its own `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` to the migration by hand**, along with any CHECK constraints and `lower(...)` indexes.
- Note that `rt_` still appears in two unrelated places, and both must stay: API key tokens (`rt_` + 48 hex) and the session cookie names (`rt_token`, `rt_refresh`).

## Hard restrictions

1. **All API keys and secrets stay on the backend only.** Never expose the database connection string or Supabase keys (or any secret) to the client. No `NEXT_PUBLIC_` prefix for anything sensitive. Secrets come from server-side env vars (see `.env.example`) and are never committed.
2. **All database interactions are server-side.** The UI never talks to Supabase (or any datastore) directly — it always calls back to our own API routes on Vercel (`src/app/api/**`), which are the only code allowed to touch the data layer.
3. The data layer (`src/lib/db/`) imports `server-only`, so importing it from client code is a build error. Keep it that way.

## Architecture

```
src/
  app/
    page.tsx            # Dashboard home: signed-out intro, or the user's upcoming races + club runs
    races/page.tsx      # Race table (25/page) + filter panel (client component, fetches /api/races)
    submit/page.tsx     # Race submission form (POSTs to /api/races)
    api/races/route.ts  # GET (list + filters, paginated), POST (submit a race)
    api/races/[id]/route.ts  # GET single race
    api/run-clubs/upcoming/route.ts  # GET club runs in the next N days (expanded schedules)
  components/
    nav-tabs.tsx        # Header tabs: Home, Races, Run Clubs, [My Races when signed in], World Majors
  lib/
    types.ts            # Shared domain types (Race, RaceDistance, EntryStatus, filters) — no server imports
    club-runs.ts        # Expands club schedules into dated occurrences (pure, no server imports)
    use-current-user.ts # Shared /api/auth/me hook — one fetch per navigation, broadcast to subscribers
    db/
      store.ts          # RaceStore interface — the only contract the app depends on
      index.ts          # getRaceStore() — the single entry point to the data layer
      prisma-store.ts   # RaceStore implemented with Prisma (every table query lives here)
      prisma.ts         # PrismaClient singleton (pg driver adapter, schema from DB_SCHEMA)
      connection.ts     # DATABASE_URL / DIRECT_URL / DB_SCHEMA — the only reader of those vars
  generated/prisma/     # Generated Prisma client — gitignored, rebuilt by `prisma generate`
prisma/
  schema.prisma         # Source of truth for the schema
  migrations/           # Migration history (schema-agnostic SQL — never schema-qualified)
  seed.mjs              # Starter races + World Major entry methods (`npm run db:seed`)
  README.md             # Migration workflow, schema-per-environment, connection strings
supabase/               # Historical pre-Prisma SQL — do not run, do not extend
```

## Auth & REST API

- Auth: Supabase Auth with httpOnly session cookies (`src/lib/auth.ts`) — the one part of the app that still talks to Supabase directly, since accounts live in `auth.users`, not in our tables. Plus per-user **API keys** for the REST API (`src/lib/api-keys.ts`, `api_keys` table, managed in `/settings`).
- API keys are `rt_` + 48 hex chars; only a SHA-256 hash is stored, the full key is shown once at creation. Sent as `Authorization: Bearer rt_...`. Rate limit: 100 requests/hour per key (fixed window). Max 10 active keys per user.
- Protected endpoints use `getRequestUser()` (session cookie OR API key): `POST /api/races`, `PATCH`/`DELETE /api/races/[id]`, all of `/api/user-races`. Key management (`/api/api-keys`) is session-only so a leaked key can't mint or revoke keys. Race listing/detail endpoints stay public.
- Duplicate races are rejected (409): same name + date + city + country, case-insensitive — pre-checked via `findDuplicateRace` and enforced by the `races_dedup_idx` unique index.
- **RBAC** (`src/lib/roles.ts`, `user_roles` table; a user with no row is a plain `user`): `admin` manages roles at `/admin/users` (API: `/api/users`, session + admin only; admins can't change their own role); `moderator` (and admin) can edit/delete any race; `user` can edit only races they submitted (`races.submitted_by`) and cannot delete. `/api/auth/me` returns the role for UI gating.
- **RBAC is enforced in both layers, and the API is the one that counts.** Gate it twice for every protected operation:
  - **API (the real boundary).** Every mutating route authenticates first (`getRequestUser` for session-or-key routes, `getCurrentUser` for session-only ones), then checks role/ownership *before* the write. Derive the acting user's id from the auth result only — never from the request body or a query param — and scope every store call to it. A route that returns data or accepts a write without one of these checks is a bug, even if no UI links to it.
  - **UI (cosmetic only).** Hide actions the user can't perform, using `/api/auth/me` for the role: gate create pages with `RequireLogin` (`src/components/require-login.tsx`), and render edit/delete controls only when the same rule the API enforces passes. This exists so users don't hit avoidable 403s — it is never the protection itself, and API checks are never relaxed because the UI already hides something.
- Ownership rule for content: the creator (race `submitted_by`, club `owner_id`) or a moderator/admin may edit. Race deletion is moderator/admin only; club deletion also allows the owner.
- **Privilege management is session-only**: role changes (`/api/users*`) and API key management (`/api/api-keys*`) reject API-key auth entirely, so a leaked key can never escalate itself or mint more keys. Keep any future route that grants or manages access on this pattern.
- Race submission payload validation lives in `src/lib/validate-race.ts` (shared by POST and PATCH). Races carry `entryMethods` (`[{method, opens, closes}]`, jsonb) — the World Majors page is driven by races tagged `World Major` and their entry methods; race facts are corrected via the edit page (`/races/[id]/edit`), not code.
- **Address search** (`src/lib/places.ts`, `/api/places` + `/api/places/[placeId]`): Google Places API (New), proxied server-side — `GOOGLE_PLACES_API_KEY` never reaches the browser, so no Maps JS SDK. Both routes require login (Places is metered; an open proxy is a billing drain) and 503 when the key is unset, leaving manual city/country entry working. Autocomplete and details calls share a client-generated session token so Google bills them as one session. A submitted `placeId` is **re-resolved server-side** (`applyPlaceDetails`) to derive country, coordinates, and formatted address — never trust those from the client; `city`/`region` are prefilled from the same lookup but stay user-editable, since Google's locality component is unreliable across countries.
- **Navigation & dashboard**: header tabs come from `src/components/nav-tabs.tsx` — Home, Races, Run Clubs, World Majors always; My Races only when signed in. Client components read the session through `useCurrentUser()` (`src/lib/use-current-user.ts`) rather than fetching `/api/auth/me` themselves, so the header and page body agree and share one request; call `refreshCurrentUser()` after login/logout. Club runs on the dashboard come from `GET /api/run-clubs/upcoming`, which expands stored schedules with `upcomingClubRuns` (`src/lib/club-runs.ts`) — occurrences are never stored.
- **Run clubs** (`run_clubs`, spec in `specs/run-clubs.md`): pages `/run-clubs` (table + name/location search), `/run-clubs/new`, `/run-clubs/[id]`, `/run-clubs/[id]/edit`; API `/api/run-clubs` (+`/[id]`), validation in `src/lib/validate-run-club.ts`. Required: name, city, country; optional: street address, website, runs. A club's runs are a jsonb schedule array (`ClubRun` in `src/lib/types.ts`): weekly (day+time), monthly (nth-weekday+time), or one-off events (date) — no generated occurrence rows. The creator (`owner_id`) owns the club; owner can edit/delete their own, moderators/admins any.

## Conventions

- TypeScript strict mode; keep `npm run build` green.
- Validate all API input server-side (see `validateSubmission` in `src/app/api/races/route.ts`) — never trust the client.
- Filters are combined with AND; list endpoints default to upcoming races (today onward), sorted by date ascending, 25 per page.
- Race distances: prefer the standard list in `src/lib/types.ts` (`STANDARD_DISTANCES`); custom distances carry a label plus kilometers so they remain filterable/sortable later.

## Commands

- `npm run dev` — dev server
- `npm run build` — production build (run before pushing)
- `npm start` — serve production build
- `npm run db:migrate` — create and apply a migration from `prisma/schema.prisma`
- `npm run db:deploy` — apply pending migrations (CI / production)
- `npm run db:seed` — starter races, idempotent
- `npm run db:reset` — rebuild `DB_SCHEMA` from scratch and re-seed
