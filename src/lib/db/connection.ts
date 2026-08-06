/**
 * Database connection settings, derived from env vars in one place.
 *
 * Which Postgres *schema* the rt_ tables live in is configuration, not code:
 * `DB_SCHEMA` picks it (local_dev locally, public in production), and the
 * same Prisma migrations build whichever one is named. Nothing else in the
 * codebase should read these env vars.
 *
 * Deliberately free of `server-only` and of any `@/` alias imports: this
 * module is also loaded by prisma.config.ts, outside the Next.js runtime.
 *
 *   DATABASE_URL  connection the app uses at runtime. On Vercel this should
 *                 be Supabase's transaction pooler (port 6543).
 *   DIRECT_URL    direct/session connection (port 5432) for migrations,
 *                 which cannot run through a transaction pooler. Falls back
 *                 to DATABASE_URL when unset.
 *   DB_SCHEMA     Postgres schema holding the rt_ tables. Default: public.
 */

export const DEFAULT_SCHEMA = "public";

/** Unquoted Postgres identifier — the only shape we accept for DB_SCHEMA. */
const SCHEMA_PATTERN = /^[a-z_][a-z0-9_]*$/;

type Env = Record<string, string | undefined>;

/**
 * The schema the rt_ tables live in. Restricted to a plain lowercase
 * identifier so it can be interpolated into a search_path / URL without
 * quoting games — this value reaches the database as SQL.
 */
export function databaseSchema(env: Env = process.env): string {
  const schema = env.DB_SCHEMA?.trim();
  if (!schema) return DEFAULT_SCHEMA;
  if (!SCHEMA_PATTERN.test(schema)) {
    throw new Error(
      `Invalid DB_SCHEMA "${schema}": expected a lowercase identifier like "local_dev"`,
    );
  }
  return schema;
}

function requireUrl(name: string, env: Env): string {
  const url = env[name]?.trim();
  if (!url) {
    throw new Error(
      `${name} is not set — copy the Postgres connection string from ` +
        `Supabase → Project Settings → Database into .env.local`,
    );
  }
  return url;
}

/** Connection string the app uses at runtime (pooled where available). */
export function runtimeUrl(env: Env = process.env): string {
  return requireUrl("DATABASE_URL", env);
}

/**
 * Connection string for migrations and other schema work. The Prisma schema
 * engine understands `?schema=`, so the target schema is pinned here (it is
 * also created on first migrate if it does not exist yet).
 */
export function migrationUrl(env: Env = process.env): string {
  const url = env.DIRECT_URL?.trim() || requireUrl("DATABASE_URL", env);
  return withSchemaParam(url, databaseSchema(env));
}

/** Throwaway database Prisma rebuilds on every `migrate dev`. */
export const SHADOW_DATABASE = "prisma_shadow";

/**
 * Scratch database `prisma migrate dev` resets on every run to detect drift.
 *
 * It has to be a separate *database* using the same schema name, not a
 * sibling schema: Prisma compares the two sides including their schema
 * names, so a shadow in `<schema>_shadow` reports every table as dropped
 * and recreated. `npm run db:ensure-schema -- --shadow` creates it.
 * Override with SHADOW_DATABASE_URL to point somewhere else entirely.
 */
export function shadowUrl(env: Env = process.env): string {
  const explicit = env.SHADOW_DATABASE_URL?.trim();
  const url = new URL(
    explicit || env.DIRECT_URL?.trim() || requireUrl("DATABASE_URL", env),
  );
  if (!explicit) url.pathname = `/${SHADOW_DATABASE}`;
  url.searchParams.set("schema", databaseSchema(env));
  return url.toString();
}

function withSchemaParam(url: string, schema: string): string {
  const parsed = new URL(url);
  parsed.searchParams.set("schema", schema);
  return parsed.toString();
}
