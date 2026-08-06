# supabase/ — historical

These numbered SQL files built the production database before Prisma took over
schema management. They are kept as a record of how `public` got to its
current shape; **do not run them and do not add to them.**

Schema changes now go through `prisma/schema.prisma` and
`prisma/migrations/` — see [prisma/README.md](../prisma/README.md).
Seed data now lives in `prisma/seed.mjs` (`npm run db:seed`).

`prisma/migrations/20260805000000_init` reproduces the end state of
`migrations/0001` … `0009` from an empty database.
