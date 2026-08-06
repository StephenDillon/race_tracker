# Database migrations

Prisma owns the schema. `prisma/schema.prisma` is the source of truth, the
files under `prisma/migrations/` are the history, and the app queries through
the generated client — nothing writes DDL by hand in the Supabase SQL editor
any more.

## Which schema am I touching?

`DB_SCHEMA` decides, and nothing in `prisma/` names a schema. Local dev points
at its own (`DB_SCHEMA=local_dev` in `.env.local`), production uses `public`.
The same migrations build either one, so a throwaway schema is a cheap way to
test a migration before it reaches real data.

Connection strings come from Supabase → Project Settings → Database:

| Variable       | Which string             | Used by                     |
| -------------- | ------------------------ | --------------------------- |
| `DATABASE_URL` | Transaction pooler, 6543 | the running app             |
| `DIRECT_URL`   | Session / direct, 5432   | migrations (falls back to `DATABASE_URL`) |

Migrations cannot run over a transaction pooler, which is why there are two.

## Everyday commands

```bash
npm run db:migrate       # create + apply a migration from schema.prisma changes
npm run db:deploy        # apply pending migrations (CI, production)
npm run db:status        # what is applied, what is pending
npm run db:seed          # starter races; idempotent
npm run db:reset         # drop the schema's tables, re-migrate, re-seed
npm run db:studio        # browse the data
```

Each of these creates the schema first if it does not exist, so a brand new
database needs nothing but `npm run db:deploy && npm run db:seed`.

`db:migrate` also needs a scratch database (`prisma_shadow`) that Prisma
rebuilds on every run to detect drift. It is created automatically and holds
nothing of value. It has to be a separate database using the *same* schema
name — Prisma compares schema names too, so a `<DB_SCHEMA>_shadow` schema in
the same database makes every table look dropped and recreated. Point
`SHADOW_DATABASE_URL` elsewhere if you would rather it lived somewhere else.

## Writing a migration

1. Edit `prisma/schema.prisma`.
2. `npm run db:migrate -- --name what_changed`.
3. Read the generated SQL before committing it.

Some things Prisma cannot express, so they live as hand-written SQL at the end
of a migration file, and Prisma will neither create nor drop them:

- `ENABLE ROW LEVEL SECURITY` — **every new `rt_` table needs this line**
- `CHECK` constraints (entry status, role)
- `lower(...)` functional indexes (`rt_races_dedup_idx`, `rt_run_clubs_city_idx`)

Prisma also cannot mark a list column `NOT NULL`; array columns are nullable
in the database and always arrive as an array in the client.

## Baselining a database that predates Prisma

Production was built by the old numbered SQL files in `supabase/migrations/`.
Its tables already match the init migration, so tell Prisma that migration is
already applied instead of running it:

```bash
# with DATABASE_URL / DIRECT_URL pointing at production and DB_SCHEMA=public
npx prisma migrate resolve --applied 20260805000000_init
npm run db:deploy    # applies 20260805000100_align_pre_prisma_schema onward
```

Do this once. Every later deployment is just `npm run db:deploy` — or the
`Deploy` GitHub workflow, whose `baseline_existing_schema` input runs the
`migrate resolve` above for you the first time.

## CI

`.github/workflows/ci.yml` rebuilds the whole schema in a throwaway Postgres
on every pull request, seeds it, and then checks that replaying the
migrations produces exactly what `schema.prisma` describes. A schema change
committed without its migration fails there.
