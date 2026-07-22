create table public.rt_user_races (
  user_id uuid not null,
  race_id text not null references public.rt_races(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, race_id)
);

create index rt_user_races_user_idx on public.rt_user_races (user_id);

alter table public.rt_user_races enable row level security;
