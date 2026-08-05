-- RBAC roles, race ownership, and DB-driven World Major entry methods.

-- 1. Roles. A user without a row here is a plain 'user'.
create table public.rt_user_roles (
  user_id uuid primary key,
  role text not null check (role in ('admin', 'moderator', 'user')),
  updated_at timestamptz not null default now()
);

alter table public.rt_user_roles enable row level security;

-- Bootstrap the first admin (adjust the email if needed).
insert into public.rt_user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'yodareloaded@gmail.com'
on conflict (user_id) do update set role = 'admin', updated_at = now();

-- 2. Race ownership: who submitted a race (null for pre-existing/seed rows —
-- only moderators and admins can edit those).
alter table public.rt_races add column if not exists submitted_by uuid;

-- 3. Entry methods (how to get into the race), used by the World Majors page.
--    [{"method":"Lottery","opens":"2025-10-15","closes":"2025-12-01"}, ...]
alter table public.rt_races
  add column if not exists entry_methods jsonb not null default '[]'::jsonb;

-- Seed entry methods for the majors (moved out of the hardcoded page).
update public.rt_races set entry_methods = '[
  {"method":"Lottery","opens":"2025-10-15","closes":"2025-12-01"},
  {"method":"Time Qualifier","opens":"2025-10-15","closes":"2026-06-30"},
  {"method":"Tour Operator","opens":"2025-11-01","closes":"2026-07-31"},
  {"method":"Charity","opens":"2025-11-01","closes":"2026-07-31"}
]'::jsonb where name = 'Berlin Marathon';

update public.rt_races set entry_methods = '[
  {"method":"Lottery","opens":"2025-12-01","closes":"2025-12-31"},
  {"method":"Time Qualifier","opens":"2026-01-15","closes":"2026-05-15"},
  {"method":"Charity","opens":"2026-01-01","closes":"2026-08-01"},
  {"method":"Legacy Finisher (5+ finishes)","opens":"2025-12-01","closes":"2026-03-01"}
]'::jsonb where name = 'Chicago Marathon';

update public.rt_races set entry_methods = '[
  {"method":"Lottery","opens":"2026-01-15","closes":"2026-02-13"},
  {"method":"Time Qualifier","opens":"2026-01-15","closes":"2026-08-01"},
  {"method":"9+1 Program (2025)","opens":"2025-01-01","closes":"2025-12-31"},
  {"method":"Charity","opens":"2026-02-01","closes":"2026-09-01"}
]'::jsonb where name = 'New York City Marathon';

update public.rt_races set entry_methods = '[
  {"method":"Lottery","opens":"2026-08-01","closes":"2026-08-31"},
  {"method":"Charity (One Tokyo Premium)","opens":"2026-07-01","closes":"2026-11-30"},
  {"method":"Tour Operator","opens":"2026-09-01","closes":"2026-12-31"}
]'::jsonb where name = 'Tokyo Marathon';

update public.rt_races set entry_methods = '[
  {"method":"Time Qualifier (BQ)","opens":"2026-09-08","closes":"2026-09-15"},
  {"method":"Charity","opens":"2026-10-01","closes":"2027-01-31"},
  {"method":"Tour Operator","opens":"2026-10-01","closes":"2027-02-28"}
]'::jsonb where name = 'Boston Marathon';

update public.rt_races set entry_methods = '[
  {"method":"Ballot","opens":"2026-04-01","closes":"2026-05-01"},
  {"method":"Good for Age","opens":"2026-10-01","closes":"2026-11-01"},
  {"method":"Championship Entry","opens":"2026-10-01","closes":"2026-11-01"},
  {"method":"Charity","opens":"2026-05-01","closes":"2027-01-31"}
]'::jsonb where name = 'London Marathon';

update public.rt_races set entry_methods = '[
  {"method":"Open Registration","opens":"2025-10-01","closes":"2026-08-01"},
  {"method":"Charity","opens":"2025-11-01","closes":"2026-07-31"}
]'::jsonb where name = 'Sydney Marathon';

-- Cape Town joined the majors but its DB row is untagged; tag it so the
-- World Majors page (now driven by this tag) picks it up. Entry methods are
-- left empty — fill them in via the race edit page when known.
update public.rt_races
  set tags = array_append(tags, 'World Major')
  where name = 'Cape Town Marathon' and not ('World Major' = any(tags));
