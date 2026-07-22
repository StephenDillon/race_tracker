# Race Tracker

Find running races to participate in. Browse a table of upcoming races and filter by date, distance, location, entry criteria (open, ballot, closed, …), World Marathon Majors, and major qualifiers. Anyone can submit a race using standard distances or a custom one.

## Stack

- [Next.js](https://nextjs.org) (App Router) + [Tailwind CSS](https://tailwindcss.com)
- [Supabase](https://supabase.com) (Postgres) for the database — all tables prefixed `rt_`
- Deployed on Vercel

All data access is server-side: the UI only calls this app's own API routes (`/api/races`); API keys never reach the client.

## Development

```bash
npm install
npm run dev
```

Open http://localhost:3000. Without Supabase env vars the app runs on an in-memory store with seed data, so no setup is needed for local UI work.

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com/dashboard).
2. In the SQL Editor, run `supabase/migrations/0001_create_rt_races.sql`, then (optionally) `supabase/seed.sql` for sample races.
3. Grab the credentials from **Project Settings → API**: the Project URL and the `service_role` key (not the anon key — the anon key is useless here since RLS blocks it).

To use Supabase locally, put them in `.env.local` (never committed):

```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role key>
```

## Vercel deployment

1. Import the GitHub repo at [vercel.com/new](https://vercel.com/new) — Next.js is auto-detected, no config needed.
2. In **Project Settings → Environment Variables**, add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (Production and Preview).
3. Deploy. Pushes to the default branch deploy to production; other branches get preview deployments.

## Project guidance

Architecture rules and contributor/agent guidance live in [AGENTS.md](./AGENTS.md).
