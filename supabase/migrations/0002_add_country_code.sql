-- Add ISO 3166-1 alpha-2 country codes for continent/country filtering.
-- Backfills the seed rows by their country display names, then requires the
-- column going forward.

alter table public.rt_races add column if not exists country_code text;

update public.rt_races set country_code = c.code
from (
  values
    ('United States', 'US'),
    ('USA', 'US'),
    ('United Kingdom', 'GB'),
    ('UK', 'GB'),
    ('Germany', 'DE'),
    ('Spain', 'ES'),
    ('France', 'FR'),
    ('Australia', 'AU'),
    ('Japan', 'JP'),
    ('Ireland', 'IE'),
    ('South Africa', 'ZA'),
    ('Norway', 'NO'),
    ('Netherlands', 'NL'),
    ('New Zealand', 'NZ'),
    ('Sweden', 'SE')
) as c(name, code)
where rt_races.country = c.name and rt_races.country_code is null;

-- Normalize display names for rows seeded before this migration.
update public.rt_races set country = 'United States' where country = 'USA';
update public.rt_races set country = 'United Kingdom' where country = 'UK';

alter table public.rt_races alter column country_code set not null;

create index if not exists rt_races_country_code_idx on public.rt_races (country_code);
