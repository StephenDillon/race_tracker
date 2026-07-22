-- Race Tracker schema. All tables in this project are prefixed with rt_.

create table if not exists public.rt_races (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  date date not null,
  -- Full distance objects as submitted:
  --   {"kind":"standard","distance":"5K"} | {"kind":"custom","label":"...","kilometers":7.7}
  distances jsonb not null,
  -- Denormalized list of the standard distances above, for fast array-overlap filtering.
  standard_distances text[] not null default '{}',
  city text not null,
  region text not null,
  country text not null,
  entry_status text not null check (
    entry_status in ('open', 'closed', 'ballot', 'waitlist', 'invitation', 'sold_out')
  ),
  is_major_marathon boolean not null default false,
  is_major_qualifier boolean not null default false,
  website text,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists rt_races_date_idx on public.rt_races (date);
create index if not exists rt_races_entry_status_idx on public.rt_races (entry_status);
create index if not exists rt_races_standard_distances_idx
  on public.rt_races using gin (standard_distances);

-- All access goes through our backend using the service role key (which
-- bypasses RLS). Enabling RLS with no policies blocks the anon/public key
-- entirely, so nothing is readable or writable from outside the backend.
alter table public.rt_races enable row level security;
