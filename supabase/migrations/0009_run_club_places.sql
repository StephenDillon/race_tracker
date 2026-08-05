-- Google Places data for run club addresses. All nullable: clubs can still
-- be entered manually (city + country only), and existing rows predate this.
alter table public.rt_run_clubs
  add column if not exists place_id text,
  add column if not exists formatted_address text,
  add column if not exists region text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

-- Coordinates are stored now so a future "clubs near me" radius search has
-- the data; nothing reads them yet.
create index if not exists rt_run_clubs_latlng_idx
  on public.rt_run_clubs (latitude, longitude);
