-- Run clubs: community running groups with a home location and an optional
-- schedule of runs (weekly, monthly, or one-off events) stored as jsonb —
-- see ClubRun in src/lib/types.ts for the shape.
create table public.rt_run_clubs (
  id text primary key,
  name text not null,
  -- Street-level meetup address is optional; city + country are the minimum.
  address text,
  city text not null,
  country text not null,
  country_code text not null,
  website text,
  runs jsonb not null default '[]'::jsonb,
  owner_id uuid not null,
  created_at timestamptz not null default now()
);

create index rt_run_clubs_city_idx on public.rt_run_clubs (lower(city));

-- Same posture as every rt_ table: RLS on, no policies — only the backend
-- (service role key) can touch it.
alter table public.rt_run_clubs enable row level security;
