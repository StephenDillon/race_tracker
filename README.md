# Race Tracker

Find running races to participate in. Browse a table of upcoming races and filter by date, distance, location, entry criteria (open, ballot, closed, …), World Marathon Majors, and major qualifiers. Anyone can submit a race using standard distances or a custom one.

## Stack

- [Next.js](https://nextjs.org) (App Router) + [Tailwind CSS](https://tailwindcss.com)
- [Supabase](https://supabase.com) (Postgres) for the database, queried through [Prisma](https://www.prisma.io) — in a schema this app owns, never `public`
- Supabase Auth for accounts and sessions
- Deployed on Vercel

All data access is server-side: the UI only calls this app's own API routes (`/api/races`); credentials never reach the client.

## Setup

1. Create a project at [supabase.com](https://supabase.com/dashboard).
2. Copy `.env.example` to `.env.local` and fill it in:
   - `DATABASE_URL` / `DIRECT_URL` — **Project Settings → Database → Connection string** (transaction pooler for the first, session/direct for the second)
   - `DB_SCHEMA` — the Postgres schema this environment owns: `rt_local`. Never `public` (see below)
   - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — **Project Settings → API**, for Auth
3. Build the schema and start the app:

```bash
npm install
npm run db:deploy
npm run dev
```

Open http://localhost:3000. The database starts empty — there is no seed
data, so add races by submitting them through the app.

The app owns an entire Postgres schema — `rt_local` in development, `rt_prod`
in production — and every table in it, so tables are named plainly (`races`,
`run_clubs`, …). `public` is **not** available: this database is shared with
other projects whose tables live there, including their own `races` and
`users`, so `DB_SCHEMA` is required and `public` is rejected.

Schema changes go through Prisma — see [prisma/README.md](./prisma/README.md).

## Deployment

Pushes to `main` run [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml),
which builds the app, applies any pending migrations, and only then makes the
new deployment live — so the code never serves against a schema it does not
expect. Pull requests run [CI](.github/workflows/ci.yml): typecheck, build,
and a full rebuild of the schema in a throwaway Postgres.

One-time setup:

1. Import the GitHub repo at [vercel.com/new](https://vercel.com/new) — Next.js is auto-detected, no config needed.
2. In Vercel **Project Settings → Environment Variables**, add `DATABASE_URL`, `DIRECT_URL`, `DB_SCHEMA=rt_prod`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `GOOGLE_PLACES_API_KEY`.
3. Vercel's own Git deploys are switched off by [`vercel.json`](./vercel.json) (`git.deploymentEnabled: false`) — the workflow deploys instead. Leaving both on would deploy everything twice and lose the migrate-then-deploy ordering.
4. In GitHub **Settings → Secrets and variables → Actions**, add secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (the last two are in `.vercel/repo.json` or `.vercel/project.json` after running `vercel link`), plus `DATABASE_URL` and `DIRECT_URL`. Add the repository **variable** `DB_SCHEMA` = `rt_prod`.

   When creating the token at [vercel.com/account/tokens](https://vercel.com/account/tokens), set its **Scope** to the team that owns the project. A token left on a different scope, or narrowed to a single project, authenticates fine but cannot read project settings — the workflow's "Verify Vercel credentials" step tells you which of those it is.

The first deploy creates `rt_prod` and builds it from empty — there is nothing to migrate or import.

## Project guidance

Architecture rules and contributor/agent guidance live in [AGENTS.md](./AGENTS.md).
