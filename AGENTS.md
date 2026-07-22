# Race Tracker — Agent Guide

## What this is

A website to easily find races you wish to participate in. The initial focus is **running** (other sports may come later). Anyone can submit races using standard known distances (5K, 10K, Half Marathon, Marathon, 50K, 50 Mile, 100K, 100 Mile) or a custom distance if they wish.

The main page shows a table of **25 upcoming races** with detailed filtering to find races, including:

- Dates / date range
- Distance
- Location
- Entry criteria (open registration, closed, ballot, waitlist, invitation, sold out)
- Major marathon (World Marathon Majors)
- Major qualifier (races whose results qualify for a major)

## Stack (do not deviate without explicit approval)

- **UI**: Next.js (App Router) with Tailwind CSS, in `src/app/`.
- **Database**: Supabase — **not wired up yet**. Until credentials are provided, all data lives in a simple in-memory store (`src/lib/db/memory.ts`) seeded from `src/lib/db/seed.ts`.
- **Deployment**: Vercel.

## Hard restrictions

1. **All API keys and secrets stay on the backend only.** Never expose Supabase keys (or any secret) to the client. No `NEXT_PUBLIC_` prefix for anything sensitive. Secrets come from server-side env vars (see `.env.example`) and are never committed.
2. **All database interactions are server-side.** The UI never talks to Supabase (or any datastore) directly — it always calls back to our own API routes on Vercel (`src/app/api/**`), which are the only code allowed to touch the data layer.
3. The data layer (`src/lib/db/`) imports `server-only`, so importing it from client code is a build error. Keep it that way.

## Architecture

```
src/
  app/
    page.tsx            # Main page: race table (25/page) + filter panel (client component, fetches /api/races)
    submit/page.tsx     # Race submission form (POSTs to /api/races)
    api/races/route.ts  # GET (list + filters, paginated), POST (submit a race)
    api/races/[id]/route.ts  # GET single race
  lib/
    types.ts            # Shared domain types (Race, RaceDistance, EntryStatus, filters) — no server imports
    db/
      store.ts          # RaceStore interface — the only contract the app depends on
      index.ts          # getRaceStore() — swap point for the Supabase implementation later
      memory.ts         # In-memory implementation (current)
      seed.ts           # Seed races
```

### Swapping in Supabase later

Implement `RaceStore` (`src/lib/db/store.ts`) with the Supabase server client using `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` from server env vars, then return it from `getRaceStore()` in `src/lib/db/index.ts`. Nothing else should need to change.

## Conventions

- TypeScript strict mode; keep `npm run build` green.
- Validate all API input server-side (see `validateSubmission` in `src/app/api/races/route.ts`) — never trust the client.
- Filters are combined with AND; list endpoints default to upcoming races (today onward), sorted by date ascending, 25 per page.
- Race distances: prefer the standard list in `src/lib/types.ts` (`STANDARD_DISTANCES`); custom distances carry a label plus kilometers so they remain filterable/sortable later.

## Commands

- `npm run dev` — dev server
- `npm run build` — production build (run before pushing)
- `npm start` — serve production build
