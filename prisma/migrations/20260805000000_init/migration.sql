-- Race Tracker initial schema: every rt_ table, built from an empty database.
--
-- Nothing here is schema-qualified. The migration runs with search_path set
-- to DB_SCHEMA (see src/lib/db/connection.ts), so the same file builds
-- local_dev, public, or any other schema. Keep it that way.
--
-- The tail of this file is hand-written: row level security, CHECK
-- constraints, and lower(...) indexes are not expressible in schema.prisma,
-- so Prisma neither creates nor drops them. New rt_ tables must add their
-- own `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` here or in a later
-- migration.

-- CreateTable
CREATE TABLE "rt_races" (
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

    CONSTRAINT "rt_races_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rt_user_races" (
    "user_id" UUID NOT NULL,
    "race_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rt_user_races_pkey" PRIMARY KEY ("user_id","race_id")
);

-- CreateTable
CREATE TABLE "rt_api_keys" (
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

    CONSTRAINT "rt_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rt_user_roles" (
    "user_id" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rt_user_roles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "rt_run_clubs" (
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

    CONSTRAINT "rt_run_clubs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rt_races_date_idx" ON "rt_races"("date");

-- CreateIndex
CREATE INDEX "rt_races_entry_status_idx" ON "rt_races"("entry_status");

-- CreateIndex
CREATE INDEX "rt_races_country_code_idx" ON "rt_races"("country_code");

-- CreateIndex
CREATE INDEX "rt_races_standard_distances_idx" ON "rt_races" USING GIN ("standard_distances" array_ops);

-- CreateIndex
CREATE INDEX "rt_races_tags_idx" ON "rt_races" USING GIN ("tags" array_ops);

-- CreateIndex
CREATE INDEX "rt_user_races_user_idx" ON "rt_user_races"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "rt_api_keys_key_hash_key" ON "rt_api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "rt_api_keys_user_idx" ON "rt_api_keys"("user_id");

-- CreateIndex
CREATE INDEX "rt_run_clubs_latlng_idx" ON "rt_run_clubs"("latitude", "longitude");

-- AddForeignKey
ALTER TABLE "rt_user_races" ADD CONSTRAINT "rt_user_races_race_id_fkey" FOREIGN KEY ("race_id") REFERENCES "rt_races"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- ---------------------------------------------------------------------------
-- Beyond schema.prisma
-- ---------------------------------------------------------------------------

-- Allowed values, mirroring EntryStatus and Role in src/lib/types.ts.
ALTER TABLE "rt_races" ADD CONSTRAINT "rt_races_entry_status_check"
  CHECK ("entry_status" IN ('open', 'closed', 'ballot', 'waitlist', 'invitation', 'sold_out'));

ALTER TABLE "rt_user_roles" ADD CONSTRAINT "rt_user_roles_role_check"
  CHECK ("role" IN ('admin', 'moderator', 'user'));

-- Deduplication: no two races may share a name, date, and location. The API
-- pre-checks this to return a friendly 409; the index is the
-- race-condition-proof backstop, so its name is matched on in
-- src/app/api/races/route.ts.
CREATE UNIQUE INDEX "rt_races_dedup_idx"
  ON "rt_races" (lower("name"), "date", lower("city"), "country_code");

-- Case-insensitive club lookups by city.
CREATE INDEX "rt_run_clubs_city_idx" ON "rt_run_clubs" (lower("city"));

-- Every rt_ table runs with RLS enabled and no policies: the backend
-- connects as the database owner (which bypasses RLS), so nothing reached
-- through PostgREST or an anon key can read or write these tables.
ALTER TABLE "rt_races" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rt_user_races" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rt_api_keys" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rt_user_roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rt_run_clubs" ENABLE ROW LEVEL SECURITY;
