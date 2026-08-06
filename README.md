# Race Tracker

Find running races to participate in. Browse a table of upcoming races and filter by date, distance, location, entry criteria (open, ballot, closed, …), World Marathon Majors, and major qualifiers. Anyone can submit a race using standard distances or a custom one.

## Stack

- [Next.js](https://nextjs.org) (App Router) + [Tailwind CSS](https://tailwindcss.com)
- [Supabase](https://supabase.com) (Postgres) for the database, queried through [Prisma](https://www.prisma.io) — all tables prefixed `rt_`
- Supabase Auth for accounts and sessions
- Deployed on Vercel

All data access is server-side: the UI only calls this app's own API routes (`/api/races`); credentials never reach the client.

## Setup

1. Create a project at [supabase.com](https://supabase.com/dashboard).
2. Copy `.env.example` to `.env.local` and fill it in:
   - `DATABASE_URL` / `DIRECT_URL` — **Project Settings → Database → Connection string** (transaction pooler for the first, session/direct for the second)
   - `DB_SCHEMA` — the Postgres schema to build in, e.g. `local_dev`, so local work stays clear of production data
   - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — **Project Settings → API**, for Auth
3. Create the schema and load sample races:

```bash
npm install
npm run db:deploy
npm run db:seed
npm run dev
```

Open http://localhost:3000.

Schema changes go through Prisma — see [prisma/README.md](./prisma/README.md).

## Deployment

Pushes to `main` run [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml),
which builds the app, applies any pending migrations, and only then makes the
new deployment live — so the code never serves against a schema it does not
expect. Pull requests run [CI](.github/workflows/ci.yml): typecheck, build,
and a full rebuild of the schema in a throwaway Postgres.

One-time setup:

1. Import the GitHub repo at [vercel.com/new](https://vercel.com/new) — Next.js is auto-detected, no config needed.
2. In Vercel **Project Settings → Environment Variables**, add `DATABASE_URL`, `DIRECT_URL`, `DB_SCHEMA=public`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `GOOGLE_PLACES_API_KEY`.
3. In Vercel **Project Settings → Git**, turn off automatic deploys (set the Ignored Build Step to `exit 0`, or disconnect the repo). The workflow deploys instead; leaving both on deploys everything twice and loses the migrate-then-deploy ordering.
4. In GitHub **Settings → Secrets and variables → Actions**, add secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (the last two are in `.vercel/project.json` after running `vercel link`), plus `DATABASE_URL` and `DIRECT_URL` for production. Optionally set the variable `DB_SCHEMA` if production is not `public`.
5. Production predates Prisma, so its first deploy needs baselining — run the `Deploy` workflow manually once with **baseline_existing_schema** checked. See [prisma/README.md](./prisma/README.md).

## Project guidance

Architecture rules and contributor/agent guidance live in [AGENTS.md](./AGENTS.md).
