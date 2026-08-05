-- API keys for the public REST API. The full key is shown to the user once at
-- creation; only a SHA-256 hash is stored, plus a short prefix for display.

create table public.rt_api_keys (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null,
  name text not null,
  key_hash text not null unique,
  key_prefix text not null,
  -- Fixed-window rate limiting state (window length/limit live in app code).
  window_start timestamptz,
  window_count integer not null default 0,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index rt_api_keys_user_idx on public.rt_api_keys (user_id);

-- Same pattern as every rt_ table: RLS on, no policies — only the backend
-- (service role key) can touch it.
alter table public.rt_api_keys enable row level security;

-- Deduplication: no two races may share the same name, date, and location.
-- The API also pre-checks this to return a friendly 409; the index is the
-- race-condition-proof backstop.
create unique index if not exists rt_races_dedup_idx
  on public.rt_races (lower(name), date, lower(city), country_code);
