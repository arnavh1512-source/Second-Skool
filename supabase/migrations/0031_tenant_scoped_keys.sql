-- ============================================================================
-- A ROW BELONGS TO A STUDENT *AND* TO THAT STUDENT'S CENTRE — Second Skool
--
-- Every centre-scoped child table carries two columns that describe ownership:
--
--   student_id uuid not null references public.students(id)
--   centre_id  uuid references public.centres(id) default public.current_centre()
--
-- The foreign key proves the student exists. Nothing has ever proved the two
-- agree. A fee row could name a student from centre A and a centre_id of B,
-- and Postgres would accept it: the FK is satisfied, and the RLS policy checks
-- centre_id, which is the caller's own. The row would then be visible to B,
-- attached to A's child, and invisible to A — the centre that actually owns
-- that family cannot see or delete it.
--
-- Today the only thing standing in the way is that a head cannot learn another
-- centre's student UUIDs. That is secrecy, not integrity, and secrecy is the
-- kind of protection that survives right up until one query somewhere returns
-- an id it did not need to. Multi-tenancy in this app is enforced by the
-- database on purpose; this is the half that was still being enforced by
-- nobody knowing the number.
--
-- Run this in Supabase -> SQL Editor. Safe to re-run.
--
-- ⚠️ This one WRITES before it constrains: any child row whose centre_id
-- disagrees with its student's is repaired to the student's centre first. The
-- student is the authority — the row is about that child, so it belongs to
-- whoever the child belongs to. On a healthy database the repair touches
-- nothing. To see what it would touch before running, per table:
--
--   select count(*) from public.fees f join public.students s on s.id=f.student_id
--    where f.centre_id is distinct from s.centre_id;
-- ============================================================================

-- The composite target the child keys point at. `id` is already the primary
-- key, so this adds no new uniqueness — it exists because Postgres requires a
-- unique constraint covering exactly the referenced column pair.
--
-- Added, never dropped-and-recreated. The five child keys below reference this
-- constraint, so the second run of a `drop ... if exists` fails with 2BP01
-- ("other objects depend on it") — which is exactly what happened the first
-- time this file was re-run against a database it had already been applied to.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'students_id_centre_key'
       and conrelid = 'public.students'::regclass
  ) then
    alter table public.students add constraint students_id_centre_key unique (id, centre_id);
  end if;
end $$;

do $$
declare t text;
begin
  foreach t in array array['results','attendance','fees','notifications','attendance_monthly']
  loop
    -- Repair before constraining. A mismatch here is a bug that already
    -- happened, and refusing to run would leave the door open rather than
    -- closing it.
    execute format(
      'update public.%I c set centre_id = s.centre_id from public.students s
        where s.id = c.student_id and c.centre_id is distinct from s.centre_id', t);

    -- The single-column key is subsumed: (student_id, centre_id) proves the
    -- student exists as well, and carries the same cascade.
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_student_id_fkey');
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_student_centre_fk');
    execute format(
      'alter table public.%I add constraint %I foreign key (student_id, centre_id)
         references public.students(id, centre_id) on update cascade on delete cascade',
      t, t || '_student_centre_fk');
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- One consequence worth stating out loud: centre_id stays nullable on these
-- tables, and a composite foreign key with a NULL in it is not enforced
-- (MATCH SIMPLE, the SQL default). So a row written with no centre_id is
-- unconstrained — exactly as it is today, and already unreachable, because
-- every RLS policy on these tables filters on centre_id and NULL matches
-- nothing. Making the column NOT NULL is the next step and belongs in its own
-- migration, behind a check that no live row is missing it.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Record this migration as applied. Keep this block last in every file.
-- ---------------------------------------------------------------------------
insert into public.schema_migrations (version) values ('0031_tenant_scoped_keys')
  on conflict (version) do nothing;
