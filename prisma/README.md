# Database migrations

Prisma owns the schema. `prisma/schema.prisma` is the source of truth, the
files under `prisma/migrations/` are the history, and the app queries through
the generated client — nothing writes DDL by hand in the Supabase SQL editor.

## Which schema am I touching?

This app owns an entire Postgres schema and every table in it, which is why
the tables have plain names (`races`, `run_clubs`, …). `DB_SCHEMA` decides
which schema, and nothing in `prisma/` names one:

| Environment | `DB_SCHEMA` |
| ----------- | ----------- |
| local dev   | `rt_local`  |
| production  | `rt_prod`   |
| CI          | `ci` (throwaway) |

**Never `public`.** This Postgres instance is shared with other projects,
whose tables live in `public` and include their own `races` and `users`.
`databaseSchema()` in `src/lib/db/connection.ts` rejects it, and requires
`DB_SCHEMA` to be set rather than defaulting anywhere.

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
npm run db:reset         # drop the schema's tables and re-migrate
npm run db:studio        # browse the data
```

Each of these creates the schema first if it does not exist, so a brand new
environment needs nothing but `npm run db:deploy`. It comes up empty.

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

- `ENABLE ROW LEVEL SECURITY` — **every new table needs this line**
- `CHECK` constraints (entry status, role)
- `lower(...)` functional indexes (`races_dedup_idx`, `run_clubs_city_idx`)

Prisma also cannot mark a list column `NOT NULL`; array columns are nullable
in the database and always arrive as an array in the client.

## CI

`.github/workflows/ci.yml` rebuilds the whole schema in a throwaway Postgres
on every pull request, then checks that replaying the migrations produces
exactly what `schema.prisma` describes. A schema change committed without its
migration fails there.

There is no seed data: every environment starts empty, and races arrive by
being submitted through the app.
