-- ============================================================================
-- RECONCILE SCHEMA DRIFT — Second Skool
--
-- Production and the migrations in this repo had quietly diverged in two
-- places. Neither breaks production today; both mean an environment rebuilt
-- from these files — staging, a new laptop, a restore — behaves differently
-- from the database that holds the real students. That is the drift worth
-- fixing, because it is the environment you test in that lies to you.
--
-- Found by comparing every foreign key in the live database against every
-- `references` clause in supabase/migrations. These two were the only
-- disagreements; the other 43 constraints match exactly.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. centres.owner_id — repo says NO ACTION, production says SET NULL.
--
--   0001_baseline.sql:31  owner_id uuid references public.profiles(id)
--                         -> no ON DELETE clause, which means NO ACTION
--   live database         ON DELETE SET NULL
--
-- SET NULL is also the rule we want, so this records production rather than
-- reverting it. The alternatives are both worse:
--   * NO ACTION — deleting a head's profile fails while their centre points at
--     it, so removing a person first requires deleting their centre.
--   * CASCADE — deleting a head's profile deletes the centre, and with it every
--     student, fee, attendance row and result belonging to a paying customer.
-- SET NULL leaves the centre ownerless but completely intact, and the operator
-- console can seat itself into it to reassign a head.
--
-- Against production this is a no-op in effect: the constraint is dropped and
-- re-added with the semantics it already has.
-- ---------------------------------------------------------------------------
alter table public.centres drop constraint if exists centres_owner_id_fkey;
alter table public.centres add constraint centres_owner_id_fkey
  foreign key (owner_id) references public.profiles(id) on delete set null;

-- ---------------------------------------------------------------------------
-- 2. profiles.centre_id carries the same foreign key twice.
--
-- The baseline declares `centre_id uuid` bare and then adds the FK in a guarded
-- block that checks for the name `profiles_centre_fk`. Production also has
-- `profiles_centre_id_fkey` — the name Postgres auto-generates for an inline
-- `references` — which no migration in this repo creates. It was added out of
-- band, and because the guard only looks for the other name, the two coexist.
--
-- They are identical: same column, same target, same ON UPDATE/ON DELETE, both
-- validated, neither deferrable. So every insert or update of profiles.centre_id
-- pays for the same referential check twice, and every centres delete scans
-- profiles twice. Dropping one enforces nothing less.
--
-- The repo-declared name is the one that survives.
-- ---------------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_centre_id_fkey;

-- Belt and braces: if some environment has the auto-named one but not the
-- baseline's, re-add it rather than leaving centre_id unconstrained.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_centre_fk') then
    alter table public.profiles add constraint profiles_centre_fk
      foreign key (centre_id) references public.centres(id);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Record this migration as applied. Keep this block last in every file.
-- ---------------------------------------------------------------------------
insert into public.schema_migrations (version) values ('0018_schema_drift')
  on conflict (version) do nothing;
