-- The realtime watchers nobody was publishing to.
--
-- 0001 added public.profiles to the supabase_realtime publication, which is what
-- makes the head's staff-approval alert fire the instant a teacher requests
-- access. Two more watchers were written since and neither table was ever added:
--
--   students        the "someone requested to join" alert
--   student_devices the "a phone is waiting to be allowed" alert
--
-- A channel subscribed to a table outside the publication subscribes happily and
-- then never receives a row, so both looked wired and neither fired. The phone
-- one matters most: an unapproved device is a family locked out of the app until
-- a human notices, and the notice was the whole point.
--
-- Row-level security still decides what each subscriber actually receives, so
-- adding the tables here widens nothing: staff see their own centre's events and
-- anon sees none, exactly as the table policies already say.

do $$ begin
  if not exists (select 1 from pg_publication_tables
                  where pubname='supabase_realtime' and schemaname='public' and tablename='students') then
    alter publication supabase_realtime add table public.students;
  end if;
  if not exists (select 1 from pg_publication_tables
                  where pubname='supabase_realtime' and schemaname='public' and tablename='student_devices') then
    alter publication supabase_realtime add table public.student_devices;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Record this migration as applied. Keep this block last in every file.
-- ---------------------------------------------------------------------------
insert into public.schema_migrations (version) values ('0042_the_live_watchers_were_listening_to_a_silent_table')
  on conflict (version) do nothing;
