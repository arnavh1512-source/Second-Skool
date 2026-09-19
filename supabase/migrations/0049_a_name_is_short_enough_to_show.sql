-- ---------------------------------------------------------------------------
-- 0049 — a name is short enough to show
--
-- A pending teacher's full_name goes straight into the push the head gets
-- ("<name> is requesting access to your centre"). The route now trims it to 60
-- characters, but the column itself had no limit, and every screen that lists
-- staff renders it too. 120 is well past any real name and far short of a
-- lock screen full of text.
--
-- NOT VALID: existing rows are not rechecked, every new or edited row is.
-- ---------------------------------------------------------------------------

alter table public.profiles drop constraint if exists profiles_full_name_len;
alter table public.profiles add constraint profiles_full_name_len
  check (full_name is null or char_length(full_name) <= 120) not valid;

-- ---------------------------------------------------------------------------
-- Record this migration as applied. Keep this block last in every file.
-- ---------------------------------------------------------------------------
insert into public.schema_migrations (version) values ('0049_a_name_is_short_enough_to_show')
  on conflict (version) do nothing;
