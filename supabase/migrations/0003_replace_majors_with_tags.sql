-- Replace is_major_marathon / is_major_qualifier booleans with a tags text[] column.

alter table public.rt_races add column if not exists tags text[] not null default '{}';

-- Migrate existing data: map the boolean flags to tag values.
update public.rt_races
set tags = (
  select coalesce(array_agg(t), '{}')
  from unnest(
    case when is_major_marathon then array['World Major'] else '{}' end
    || case when is_major_qualifier then array['World Major Qualifier'] else '{}' end
  ) as t
);

-- Drop the old boolean columns.
alter table public.rt_races drop column if exists is_major_marathon;
alter table public.rt_races drop column if exists is_major_qualifier;

-- Index for array-overlap filtering on tags.
create index if not exists rt_races_tags_idx on public.rt_races using gin (tags);
