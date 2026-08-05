-- Replace race ids with short unique keys (8 lowercase alphanumeric chars).
-- New races get their key from the app server on POST; existing rows get
-- fresh keys here — old ids (uuids/slugs) and their URLs are not preserved.

-- rt_user_races.race_id references rt_races.id, so drop the FK while re-keying.
alter table public.rt_user_races drop constraint rt_user_races_race_id_fkey;

create temp table rt_id_map as
select id as old_id, substr(md5(gen_random_uuid()::text || id), 1, 8) as new_id
from public.rt_races;

-- Collisions at this scale are practically impossible, but fail loudly if ever.
do $$
begin
  if (select count(*) from rt_id_map) <> (select count(distinct new_id) from rt_id_map) then
    raise exception 'short key collision — rerun this migration';
  end if;
end $$;

update public.rt_races r set id = m.new_id from rt_id_map m where r.id = m.old_id;
update public.rt_user_races ur set race_id = m.new_id from rt_id_map m where ur.race_id = m.old_id;

drop table rt_id_map;

alter table public.rt_user_races
  add constraint rt_user_races_race_id_fkey
  foreign key (race_id) references public.rt_races(id) on delete cascade;

-- Keys come from the server (generateRaceKey in src/lib/db/supabase.ts);
-- drop the uuid default so nothing else can mint ids in another format.
alter table public.rt_races alter column id drop default;
