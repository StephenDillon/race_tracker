/**
 * Create the Postgres schema named by DB_SCHEMA if it does not exist yet,
 * so `prisma migrate` has somewhere to build. Run by the db:* npm scripts
 * before every migrate command; harmless when the schema is already there.
 *
 * With `--shadow` it also creates the scratch database `prisma migrate dev`
 * rebuilds on each run (see shadowUrl in src/lib/db/connection.ts) — a
 * separate database, not a schema, so Prisma's drift comparison lines up.
 */
import { config as loadEnv } from "dotenv";
import pg from "pg";
import { databaseSchema, shadowUrl } from "../src/lib/db/connection.ts";

loadEnv({ path: [".env.local", ".env"], quiet: true });

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error(
    "DIRECT_URL / DATABASE_URL is not set — add the Supabase Postgres " +
      "connection string to .env.local (see .env.example).",
  );
  process.exit(1);
}

// databaseSchema() only accepts a plain lowercase identifier, so this is safe
// to interpolate; Postgres has no parameter binding for DDL identifiers.
const schema = databaseSchema();

async function ensureSchema(url, label) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    console.log(`Schema ready: ${schema} (${label})`);
  } finally {
    await client.end();
  }
}

/** CREATE DATABASE has no IF NOT EXISTS, and cannot run inside a transaction. */
async function ensureShadowDatabase(url) {
  const name = new URL(url).pathname.slice(1);
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const { rowCount } = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [name],
    );
    if (rowCount === 0) {
      await client.query(`CREATE DATABASE "${name}"`);
      console.log(`Created shadow database: ${name}`);
    }
  } finally {
    await client.end();
  }
}

await ensureSchema(connectionString, "target");

if (process.argv.includes("--shadow")) {
  const shadow = shadowUrl();
  await ensureShadowDatabase(shadow);
  await ensureSchema(shadow, "shadow");
}
