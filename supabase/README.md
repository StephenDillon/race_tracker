# supabase/ — historical

These numbered SQL files built the original `public.rt_*` tables by hand,
before Prisma took over schema management. They are kept only as a record of
how that schema evolved; **do not run them and do not add to them.**

The app no longer uses those tables. It now owns a dedicated Postgres schema
per environment (`rt_local`, `rt_prod`) holding plainly-named tables —
`races`, `user_races`, `api_keys`, `user_roles`, `run_clubs` — built from
scratch by `prisma/migrations/`. The old `public.rt_*` tables are orphaned
and can be dropped whenever you are confident nothing wants their data.

Schema changes go through `prisma/schema.prisma` — see
[prisma/README.md](../prisma/README.md). Seed data lives in
`prisma/seed.mjs` (`npm run db:seed`).
