-- ============================================================
-- Batches: head-only, centre-scoped reference list (mirrors subjects)
-- + a free-text `batch` label on students.
-- Safe to run more than once (idempotent).
-- ============================================================

-- 1) Reference table. centre_id auto-stamps to the head's centre on insert.
create table if not exists public.batches (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  centre_id uuid references public.centres(id) default public.current_centre(),
  created_at timestamptz default now()
);

-- One batch name per centre (case-sensitive; the app also guards duplicates).
create unique index if not exists batches_centre_name_idx
  on public.batches (centre_id, name);

alter table public.batches enable row level security;

-- Head can create/update/delete batches in their own centre.
drop policy if exists batches_head on public.batches;
create policy batches_head on public.batches for all to authenticated
  using (public.is_head() and centre_id = public.current_centre())
  with check (public.is_head() and centre_id = public.current_centre());

-- Any approved staff in the centre can read the batch list.
drop policy if exists batches_read on public.batches;
create policy batches_read on public.batches for select to authenticated
  using (public.is_staff() and centre_id = public.current_centre());

-- 2) Students carry a batch label (the batch NAME, not an FK — keeps the
--    approve_student RPC signature unchanged; RLS on students still applies).
alter table public.students
  add column if not exists batch text;
