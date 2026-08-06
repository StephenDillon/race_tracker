import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { databaseSchema, runtimeUrl } from "./connection";

/**
 * The one PrismaClient for the process.
 *
 * Cached on globalThis because Next.js dev reloads this module on every
 * edit, and a fresh client per reload would leak connection pools.
 *
 * The schema comes from DB_SCHEMA (see connection.ts) and is applied twice
 * on purpose: `schema` makes Prisma qualify the tables in the SQL it
 * generates, and `search_path` covers raw queries and function lookups.
 */
const globalCache = globalThis as unknown as { __rtPrisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const schema = databaseSchema();
  const adapter = new PrismaPg(
    {
      connectionString: runtimeUrl(),
      options: `-c search_path=${schema}`,
    },
    { schema },
  );

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export function getPrisma(): PrismaClient {
  if (!globalCache.__rtPrisma) {
    globalCache.__rtPrisma = createPrismaClient();
  }
  return globalCache.__rtPrisma;
}
