-- ---------------------------------------------------------------------------
-- A published mark can be corrected, but never erased.
--
-- Until now a test was write-once from the app's side: the Enter Results screen
-- inserted a test and its marks, and nothing in the product could ever open
-- them again. A teacher who typed 45 instead of 54 had two options, both bad —
-- leave the wrong mark in front of every parent in the class, or ask the head
-- to delete the whole test out of the database, taking every other student's
-- mark with it.
--
-- Editing is therefore allowed and deleting is not, and that is a deliberate
-- pair. A correction leaves the record standing and improves it. A deletion
-- makes a mark a parent has already seen vanish with no trace, which is exactly
-- the accusation this product exists to make impossible.
--
-- The database already permitted the update — results_staff and tests_staff are
-- `for all` — and already guarded it: a mark cannot exceed the test maximum
-- (0016), and the maximum cannot be lowered below a mark already recorded
-- (0016). What was missing was the record of who changed what and when.
--
-- recorded_by keeps meaning what it has always meant: the person who filed the
-- row. An edit never re-signs it (0029). The editor's name goes in a column of
-- its own, so "who entered this" and "who last touched this" are two different
-- questions with two different answers.
-- ---------------------------------------------------------------------------

alter table public.results add column if not exists edited_at timestamptz;
alter table public.results add column if not exists edited_by uuid references public.profiles(id);
alter table public.tests   add column if not exists edited_at timestamptz;
alter table public.tests   add column if not exists edited_by uuid references public.profiles(id);

-- security invoker, like the other stamping triggers: the whole point is to
-- record the caller, so it must run as the caller.
create or replace function public.stamp_edited_by()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  -- Only an update is an edit. An insert is the original filing, and leaving
  -- these columns null there is what makes "has this ever been changed?" a
  -- question the row can answer by itself.
  new.edited_at := now();
  new.edited_by := (select auth.uid());
  return new;
end $$;

drop trigger if exists results_stamp_editor on public.results;
create trigger results_stamp_editor before update on public.results
  for each row execute function public.stamp_edited_by();

drop trigger if exists tests_stamp_editor on public.tests;
create trigger tests_stamp_editor before update on public.tests
  for each row execute function public.stamp_edited_by();

-- ---------------------------------------------------------------------------
-- Record this migration as applied. Keep this block last in every file.
-- ---------------------------------------------------------------------------
insert into public.schema_migrations (version) values ('0043_a_published_mark_can_be_corrected_but_never_erased')
  on conflict (version) do nothing;
