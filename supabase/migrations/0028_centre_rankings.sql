-- ============================================================================
-- 0028 — rankings are a database question, and the database already answers it
--
-- get_student_snapshot() has computed per-subject rankings in SQL since 0021.
-- The staff app computed the same numbers a second time, in the browser, from a
-- 20,000-row `results` pull that existed for no other purpose — grep says
-- rankings were the only consumer of `results` and of the tests map built beside
-- it. So the centre's whole marks history crossed the wire on every staff load
-- to produce a leaderboard the server could have sent as a few hundred bytes.
--
-- This is the student block from 0025, lifted verbatim and scoped to the
-- caller's own centre instead of a student's. Same grouping (by st.id, so two
-- students sharing a name stay two rows — the 0021 bug), same approved-only
-- filter, same shape on the wire, so app/store/snapshot.ts's normaliser reads
-- both without knowing which one it got.
--
-- Deliberately NOT a materialized view: a view needs a refresh policy, and
-- marks change the moment a teacher publishes a test. This is one indexed
-- aggregate over a table that holds thousands of rows, not millions.
--
-- Deliberately NOT security definer either. Staff already read results, tests,
-- subjects and students for their own centre through RLS; running as the caller
-- means this function can never widen what they can see, and the explicit
-- current_centre() filter just saves the planner the work of proving it.
-- ============================================================================

create or replace function public.centre_rankings()
returns json language sql stable security invoker set search_path = public as $$
  select coalesce((
    select json_object_agg(subject, arr) from (
      select subject, json_agg(json_build_object('id', sid, 'name', name, 'score', pct)
                               order by pct desc, name) as arr
      from (
        select s.name as subject, st.id as sid, st.name as name,
               round(sum(r.marks)::numeric / nullif(sum(t.max_marks),0) * 100)::int as pct
        from public.results r
        join public.tests t on t.id = r.test_id
        join public.subjects s on s.id = t.subject_id
        join public.students st on st.id = r.student_id
        where st.centre_id = public.current_centre() and st.status = 'approved'
        group by s.name, st.id, st.name
      ) per_student
      group by subject
    ) ranked), '{}'::json)
$$;

revoke all on function public.centre_rankings() from public, anon;
grant execute on function public.centre_rankings() to authenticated;

-- ---------------------------------------------------------------------------
-- Record this migration as applied. Keep this block last in every file.
-- ---------------------------------------------------------------------------
insert into public.schema_migrations (version) values ('0028_centre_rankings')
  on conflict (version) do nothing;
