-- Fix: populate tags for all seed races.
-- Run this directly against your Supabase database.

update public.rt_races set tags = array['World Major', 'World Major Qualifier'] where id in ('berlin-marathon-2026', 'chicago-marathon-2026', 'nyc-marathon-2026', 'london-marathon-2027', 'sydney-marathon-2026', 'tokyo-marathon-2027');
update public.rt_races set tags = array['World Major'] where id in ('boston-marathon-2027');
update public.rt_races set tags = array['World Major Qualifier'] where id in ('valencia-marathon-2026', 'dublin-marathon-2026', 'manchester-marathon-2027', 'amsterdam-marathon-2026', 'gold-coast-marathon-2027', 'stockholm-marathon-2027');
update public.rt_races set tags = '{}' where tags is null;
