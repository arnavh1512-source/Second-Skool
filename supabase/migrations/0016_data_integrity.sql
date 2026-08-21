-- ============================================================================
-- DATA INTEGRITY CONSTRAINTS — Second Skool
--
-- An external QA pass edited a student to a 500-character name, an attendance
-- of 999999 and a school of `<script>alert(1)</script>`, and published a result
-- of 51 out of a maximum of 50. Every one of those values was accepted, stored,
-- and propagated into fees, rankings, reports and the student's own dashboard.
--
-- The app now validates all of it at the boundary (app/store/validate.ts), but
-- the anon API key ships to every browser, so client-side limits are a courtesy
-- to honest users, not a control. These are the same limits expressed where
-- they cannot be skipped.
--
-- Verified before writing this file: zero existing rows violate any constraint
-- below, so every one is added VALID rather than NOT VALID.
--
-- Keep these ceilings in step with LIMITS in app/store/validate.ts.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Text length ceilings. Generous — the point is to stop absurd values, not to
-- second-guess a head who has a genuinely long school name.
-- ---------------------------------------------------------------------------
alter table public.students drop constraint if exists students_text_lengths;
alter table public.students add constraint students_text_lengths check (
  length(name) between 1 and 80
  and length(class) between 1 and 40
  and length(coalesce(school, '')) <= 120
  and length(coalesce(parent_contact, '')) <= 20
  and length(coalesce(address, '')) <= 200
);

alter table public.assignments drop constraint if exists assignments_title_length;
alter table public.assignments add constraint assignments_title_length
  check (length(title) between 1 and 120);

alter table public.notes drop constraint if exists notes_title_length;
alter table public.notes add constraint notes_title_length
  check (length(title) between 1 and 120);

-- ---------------------------------------------------------------------------
-- Marks. `max_marks` had no bound at all and `marks` was a bare int, so a
-- negative mark or a mark above the paper total was a valid row.
-- ---------------------------------------------------------------------------
alter table public.tests drop constraint if exists tests_max_marks_range;
alter table public.tests add constraint tests_max_marks_range
  check (max_marks between 1 and 1000);

alter table public.results drop constraint if exists results_marks_non_negative;
alter table public.results add constraint results_marks_non_negative
  check (marks >= 0);

-- marks <= the test's max_marks spans two tables, which a CHECK constraint
-- cannot express. A trigger is the only way to hold the invariant that actually
-- matters: 51/50 is what a parent sees, and it is the reason this file exists.
create or replace function public.assert_marks_within_max()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  limit_marks int;
begin
  select max_marks into limit_marks from public.tests where id = new.test_id;
  if limit_marks is null then
    raise exception 'Test % does not exist', new.test_id;
  end if;
  if new.marks > limit_marks then
    raise exception 'Marks (%) cannot exceed the test maximum (%)', new.marks, limit_marks;
  end if;
  return new;
end;
$$;

drop trigger if exists results_marks_within_max on public.results;
create trigger results_marks_within_max
  before insert or update of marks, test_id on public.results
  for each row execute function public.assert_marks_within_max();

-- Lowering a test's max_marks below marks already recorded would sneak past the
-- trigger above, which only fires on the results side.
create or replace function public.assert_max_marks_not_below_results()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  highest int;
begin
  select max(marks) into highest from public.results where test_id = new.id;
  if highest is not null and new.max_marks < highest then
    raise exception 'Cannot set maximum to % — a recorded mark is already %', new.max_marks, highest;
  end if;
  return new;
end;
$$;

drop trigger if exists tests_max_marks_not_below_results on public.tests;
create trigger tests_max_marks_not_below_results
  before update of max_marks on public.tests
  for each row execute function public.assert_max_marks_not_below_results();

-- ---------------------------------------------------------------------------
-- Fees. amount is numeric(10,2), so anything larger already failed — but with a
-- Postgres overflow error the head never saw, so the form just sat there doing
-- nothing. A named ceiling below the overflow gives a rejection the app can
-- explain, and rules out zero and negative amounts.
-- ---------------------------------------------------------------------------
alter table public.fees drop constraint if exists fees_amount_range;
alter table public.fees add constraint fees_amount_range
  check (amount > 0 and amount <= 10000000);

alter table public.fees drop constraint if exists fees_period_length;
alter table public.fees add constraint fees_period_length
  check (length(period) between 1 and 40);

-- ---------------------------------------------------------------------------
-- Study-material links. `javascript:alert(1)` was accepted and stored, then
-- served to every student in the class. React declines to navigate one, but the
-- row outlives that renderer — a stored payload waiting for a client that does
-- follow it is not worth keeping. https only; http is refused too, because
-- these links are opened by children on shared networks.
-- ---------------------------------------------------------------------------
alter table public.notes drop constraint if exists notes_link_url_https;
alter table public.notes add constraint notes_link_url_https
  check (link_url is null or link_url ~* '^https://[^\s]+$');

-- ---------------------------------------------------------------------------
-- Record this migration as applied. Keep this block last in every file.
-- ---------------------------------------------------------------------------
insert into public.schema_migrations (version) values ('0016_data_integrity')
  on conflict (version) do nothing;
