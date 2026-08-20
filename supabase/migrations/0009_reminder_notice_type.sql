-- Fix: "Sync failed: send reminder" when sending a Notice.
--
-- The reminder composer offers five types (TeachingScreens.tsx) — Notice, Test,
-- Absence, Fee, Homework — but public.reminders.type was created with a CHECK
-- constraint that only allows four of them. Picking "Notice" therefore always
-- failed the insert, while the companion notifications insert (no such
-- constraint) succeeded — which is why only one error toast appeared.
--
-- Safe to re-run. Does not touch existing rows: every stored value is already
-- in the wider allowed set.

alter table public.reminders drop constraint if exists reminders_type_check;

alter table public.reminders
  add constraint reminders_type_check
  check (type in ('Notice', 'Test', 'Absence', 'Fee', 'Homework'));

-- ---------------------------------------------------------------------------
-- Record this migration as applied. Keep this block last in every file.
-- ---------------------------------------------------------------------------
insert into public.schema_migrations (version) values ('0009_reminder_notice_type')
  on conflict (version) do nothing;
