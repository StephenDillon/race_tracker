import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";
import { migrationUrl, shadowUrl } from "./src/lib/db/connection";

// Prisma 7 does not load .env files on its own, and Next.js conventions put
// local secrets in .env.local. Load that first so it wins over .env. The
// connection helpers read process.env when called, not at import time, so
// this runs early enough.
loadEnv({ path: [".env.local", ".env"], quiet: true });

// `prisma generate` needs no database, and runs in places that have no
// credentials (a plain `npm install`, a CI build). Only resolve connection
// strings when there is something to resolve; the migrate commands report
// their own missing-datasource error otherwise.
const hasConnection = Boolean(process.env.DATABASE_URL || process.env.DIRECT_URL);

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // Migrations run over the direct connection, against the schema named by
  // DB_SCHEMA — see src/lib/db/connection.ts.
  datasource: hasConnection
    ? { url: migrationUrl(), shadowDatabaseUrl: shadowUrl() }
    : undefined,
});
