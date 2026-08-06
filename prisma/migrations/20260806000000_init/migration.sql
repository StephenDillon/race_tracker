-- Race Tracker initial schema, built from an empty database.
--
-- Nothing here is schema-qualified. The migration runs with search_path set
-- to DB_SCHEMA (see src/lib/db/connection.ts), so the same file builds
-- rt_local, rt_prod, or a throwaway CI schema. Keep it that way.
--
-- The tail of this file is hand-written: row level security, CHECK
-- constraints, and lower(...) indexes are not expressible in schema.prisma,
-- so Prisma neither creates nor drops them. New tables must add their own
-- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` here or in a later migration.

-- CreateTable
CREATE TABLE "races" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "distances" JSONB NOT NULL,
    "standard_distances" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "city" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "country_code" TEXT NOT NULL,
    "entry_status" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "entry_methods" JSONB NOT NULL DEFAULT '[]',
    "website" TEXT,
    "description" TEXT,
    "submitted_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "races_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_races" (
    "user_id" UUID NOT NULL,
    "race_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_races_pkey" PRIMARY KEY ("user_id","race_id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "key_prefix" TEXT NOT NULL,
    "window_start" TIMESTAMPTZ(6),
    "window_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "run_clubs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT NOT NULL,
    "region" TEXT,
    "country" TEXT NOT NULL,
    "country_code" TEXT NOT NULL,
    "website" TEXT,
    "runs" JSONB NOT NULL DEFAULT '[]',
    "place_id" TEXT,
    "formatted_address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "owner_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "run_clubs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "races_date_idx" ON "races"("date");

-- CreateIndex
CREATE INDEX "races_entry_status_idx" ON "races"("entry_status");

-- CreateIndex
CREATE INDEX "races_country_code_idx" ON "races"("country_code");

-- CreateIndex
CREATE INDEX "races_standard_distances_idx" ON "races" USING GIN ("standard_distances" array_ops);

-- CreateIndex
CREATE INDEX "races_tags_idx" ON "races" USING GIN ("tags" array_ops);

-- CreateIndex
CREATE INDEX "user_races_user_id_idx" ON "user_races"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "api_keys_user_id_idx" ON "api_keys"("user_id");

-- CreateIndex
CREATE INDEX "run_clubs_latitude_longitude_idx" ON "run_clubs"("latitude", "longitude");

-- AddForeignKey
ALTER TABLE "user_races" ADD CONSTRAINT "user_races_race_id_fkey" FOREIGN KEY ("race_id") REFERENCES "races"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- ---------------------------------------------------------------------------
-- Beyond schema.prisma
-- ---------------------------------------------------------------------------

-- Allowed values, mirroring EntryStatus and Role in src/lib/types.ts.
ALTER TABLE "races" ADD CONSTRAINT "races_entry_status_check"
  CHECK ("entry_status" IN ('open', 'closed', 'ballot', 'waitlist', 'invitation', 'sold_out'));

ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_check"
  CHECK ("role" IN ('admin', 'moderator', 'user'));

-- Deduplication: no two races may share a name, date, and location. The API
-- pre-checks this to return a friendly 409; the index is the
-- race-condition-proof backstop, so its name is matched on in
-- src/app/api/races/route.ts.
CREATE UNIQUE INDEX "races_dedup_idx"
  ON "races" (lower("name"), "date", lower("city"), "country_code");

-- Case-insensitive club lookups by city.
CREATE INDEX "run_clubs_city_idx" ON "run_clubs" (lower("city"));

-- Every table runs with RLS enabled and no policies: the backend connects as
-- the database owner (which bypasses RLS), so nothing reached through
-- PostgREST or an anon key can read or write them.
ALTER TABLE "races" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_races" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "api_keys" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "run_clubs" ENABLE ROW LEVEL SECURITY;
