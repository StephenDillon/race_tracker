-- Brings a database created by the old supabase/migrations SQL files in line
-- with what the Prisma init migration produces.
--
-- Only the production `public` schema needs this: it was built before Prisma
-- and is baselined onto the init migration rather than running it (see
-- prisma/README.md). Every statement is a no-op on a database the init
-- migration created, so `prisma migrate deploy` is safe to run everywhere.

-- Prisma cannot express NOT NULL on a list column — a scalar list is always
-- non-null in the client and absent values arrive as an empty array. The old
-- SQL declared these NOT NULL, which would show up forever as schema drift.
ALTER TABLE "rt_races" ALTER COLUMN "standard_distances" DROP NOT NULL;
ALTER TABLE "rt_races" ALTER COLUMN "tags" DROP NOT NULL;
