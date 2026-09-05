-- ============================================================================
-- DEMO CENTRE — Second Skool
-- ----------------------------------------------------------------------------
-- A tuition centre that looks like a real one, so the app can be shown to a
-- head who has never seen it. Empty screens are the worst possible first
-- impression: a walk-in demo has about thirty seconds, and "imagine there were
-- students here" spends all of them.
--
-- This is NOT a migration. It is a seed you run by hand when you want the demo
-- data, and undo with demo_centre_teardown.sql when you do not. It never runs
-- in CI and nothing in the app depends on it.
--
-- WHAT IT DOES
--   * creates the centre "Shree Vidya Classes (Demo)" and makes YOUR account
--     its head, so signing in normally lands you in a full head dashboard;
--   * fills it with 3 classes, 3 teachers, 24 students, a term of attendance,
--     two rounds of tests with marks, three months of fees, a timetable,
--     notes, homework and a parent notification feed;
--   * plants the two things that actually sell the app — a student who has
--     stopped coming (surfaces on the home screen within three sessions) and
--     a class ranking board a parent can find their child on.
--
-- SAFE TO RE-RUN. It clears its own centre first and rebuilds it, so the
-- demo data is always the same age relative to today. It touches no other
-- centre and deletes no account.
--
-- BEFORE YOU RUN IT
--   1. Sign in to the app once with arnavh1512@gmail.com so the account exists.
--   2. You must not already own a different centre — one centre per owner is
--      enforced by the database. The script stops with a clear message if so.
--
-- HOW TO RUN: paste the whole file into the Supabase SQL editor and execute.
-- The last statement prints the staff code, the student join code and every
-- student code, so keep the result panel open.
-- ============================================================================


-- ─── The roster, with the two numbers that make the data believable ─────────
-- ability     — the mark this student tends to score, as a percentage
-- reliability — the percentage of sessions this student turns up to
-- Both are inputs to a deterministic hash below, never random, so the same
-- student has the same story every time the seed is re-run.

drop table if exists demo_roster;
create temp table demo_roster (
  code text primary key, name text, klass text, batch text,
  school text, parent text, ability int, reliability int, status text
);

insert into demo_roster values
  -- Class 9 Morning
  ('DEMOAB23','Aarav Patel',      'Class 9', 'Class 9 Morning',  'Nirman High School',      '+91 98250 41102', 88, 97, 'approved'),
  ('DEMOCD24','Ishita Shah',      'Class 9', 'Class 9 Morning',  'Diwan Ballubhai School',  '+91 98250 41103', 92, 98, 'approved'),
  ('DEMOEF25','Rohan Mehta',      'Class 9', 'Class 9 Morning',  'Nirman High School',      '+91 98250 41104', 71, 91, 'approved'),
  ('DEMOGH26','Diya Trivedi',     'Class 9', 'Class 9 Morning',  'Anand Niketan',           '+91 98250 41105', 79, 95, 'approved'),
  ('DEMOJK27','Kabir Desai',      'Class 9', 'Class 9 Morning',  'Sheth C.N. Vidyalaya',    '+91 98250 41106', 63, 85, 'approved'),
  ('DEMOMN28','Ananya Joshi',     'Class 9', 'Class 9 Morning',  'Diwan Ballubhai School',  '+91 98250 41107', 84, 96, 'approved'),
  ('DEMOPQ29','Vivaan Chauhan',   'Class 9', 'Class 9 Morning',  'Nirman High School',      '+91 98250 41108', 55, 78, 'approved'),

  -- Class 10 Evening
  ('DEMO2345','Riya Sharma',      'Class 10','Class 10 Evening', 'St. Xaviers School',      '+91 98250 41109', 94, 99, 'approved'),
  ('DEMO2346','Arjun Bhatt',      'Class 10','Class 10 Evening', 'Nirman High School',      '+91 98250 41110', 76, 93, 'approved'),
  ('DEMO2347','Meera Vyas',       'Class 10','Class 10 Evening', 'Anand Niketan',           '+91 98250 41111', 82, 96, 'approved'),
  ('DEMO2348','Krish Panchal',    'Class 10','Class 10 Evening', 'Sheth C.N. Vidyalaya',    '+91 98250 41112', 68, 88, 'approved'),
  ('DEMO2349','Sanya Kapadia',    'Class 10','Class 10 Evening', 'St. Xaviers School',      '+91 98250 41113', 89, 97, 'approved'),
  ('DEMO2352','Yash Solanki',     'Class 10','Class 10 Evening', 'Nirman High School',      '+91 98250 41114', 59, 74, 'approved'),
  ('DEMO2353','Nisha Rathod',     'Class 10','Class 10 Evening', 'Diwan Ballubhai School',  '+91 98250 41115', 73, 90, 'approved'),
  ('DEMO2354','Dhruv Amin',       'Class 10','Class 10 Evening', 'Anand Niketan',           '+91 98250 41116', 85, 94, 'approved'),
  ('DEMO2355','Tanvi Modi',       'Class 10','Class 10 Evening', 'St. Xaviers School',      '+91 98250 41117', 91, 98, 'approved'),
  ('DEMO2356','Harsh Prajapati',  'Class 10','Class 10 Evening', 'Sheth C.N. Vidyalaya',    '+91 98250 41118', 66, 86, 'approved'),

  -- Class 12 Science
  ('DEMO3456','Priyanka Nair',    'Class 12','Class 12 Science', 'St. Xaviers School',      '+91 98250 41119', 90, 97, 'approved'),
  ('DEMO3457','Manav Gandhi',     'Class 12','Class 12 Science', 'Nirman High School',      '+91 98250 41120', 78, 92, 'approved'),
  ('DEMO3458','Aditi Raval',      'Class 12','Class 12 Science', 'Anand Niketan',           '+91 98250 41121', 86, 95, 'approved'),
  ('DEMO3459','Jay Thakkar',      'Class 12','Class 12 Science', 'Diwan Ballubhai School',  '+91 98250 41122', 70, 89, 'approved'),
  ('DEMO3462','Sneha Pandya',     'Class 12','Class 12 Science', 'St. Xaviers School',      '+91 98250 41123', 93, 99, 'approved'),
  ('DEMO3463','Rudra Bhavsar',    'Class 12','Class 12 Science', 'Sheth C.N. Vidyalaya',    '+91 98250 41124', 61, 81, 'approved'),
  ('DEMO3464','Khushi Doshi',     'Class 12','Class 12 Science', 'Anand Niketan',           '+91 98250 41125', 81, 94, 'approved'),

  -- Two registrations waiting on the head's approval, so the approve/decline
  -- screen has something on it during the demo.
  ('DEMO7788','Zara Sheikh',      'Class 10','Class 10 Evening', 'Nirman High School',      '+91 98250 41126', 75, 90, 'pending'),
  ('DEMO7789','Parth Vaghela',    'Class 9', 'Class 9 Morning',  'Anand Niketan',           '+91 98250 41127', 69, 88, 'pending');


-- ─── The register and the marks are seeded as data, not as user actions ─────
-- These triggers exist to stamp the signed-in user onto a row. There is no
-- signed-in user in the SQL editor, so they would blank the author of every
-- seeded row. Disabled for the seed, restored immediately after; if anything
-- below fails, the whole script rolls back and they come back with it.

alter table public.students    disable trigger students_start_settled;
alter table public.attendance  disable trigger attendance_stamp_author;
alter table public.tests       disable trigger tests_stamp_author;
alter table public.assignments disable trigger assignments_stamp_author;
alter table public.notes       disable trigger notes_stamp_author;


do $seed$
declare
  c_email    constant text := 'arnavh1512@gmail.com';
  c_centre   constant text := 'Shree Vidya Classes (Demo)';
  v_owner    uuid;
  v_centre   uuid;
  v_branch   uuid;
  v_existing uuid;
  v_t_math   uuid;
  v_t_sci    uuid;
  v_t_eng    uuid;
  v_staff_code text;
  v_stu_code   text;
  v_m0 date := date_trunc('month', current_date)::date;
  v_m1 date := (date_trunc('month', current_date) - interval '1 month')::date;
  v_m2 date := (date_trunc('month', current_date) - interval '2 month')::date;
begin

  -- ── 1. Whose centre this is ───────────────────────────────────────────────
  select id into v_owner from auth.users where lower(email) = c_email;
  if v_owner is null then
    raise exception 'No account for % yet. Sign in to the app once with that address, then run this again.', c_email;
  end if;

  insert into public.profiles (id, role, staff_status, full_name, email)
  values (v_owner, 'admin', 'approved', 'Arnav Hendre', c_email)
  on conflict (id) do nothing;

  -- One centre per owner is a unique index, so an unrelated centre owned by
  -- this account would make the insert below fail with an unreadable error.
  -- Say the useful thing instead.
  select id into v_existing
  from public.centres where owner_id = v_owner and name <> c_centre;
  if v_existing is not null then
    raise exception 'This account already owns a centre (%). Delete it from the operator console first, or run this seed on a different account.', v_existing;
  end if;

  -- ── 2. Clear a previous run ───────────────────────────────────────────────
  -- Same order the operator console deletes in: leaves, then the people, then
  -- the centre. Anyone filed under the old centre is detached, never deleted.
  select id into v_centre from public.centres where name = c_centre;
  if v_centre is not null then
    delete from public.attendance         where centre_id = v_centre;
    delete from public.attendance_monthly where centre_id = v_centre;
    delete from public.results            where centre_id = v_centre;
    delete from public.assignments        where centre_id = v_centre;
    delete from public.fees               where centre_id = v_centre;
    delete from public.notifications      where centre_id = v_centre;
    delete from public.reminders          where centre_id = v_centre;
    delete from public.meetings           where centre_id = v_centre;
    delete from public.timetable          where centre_id = v_centre;
    delete from public.notes              where centre_id = v_centre;
    delete from public.push_subscriptions where centre_id = v_centre;
    delete from public.batches            where centre_id = v_centre;

    update public.profiles set centre_id = null, branch_id = null where centre_id = v_centre;

    delete from public.tests    where centre_id = v_centre;
    delete from public.students where centre_id = v_centre;  -- cascades student_devices
    delete from public.teachers where centre_id = v_centre;
    delete from public.subjects where centre_id = v_centre;
    delete from public.branches where centre_id = v_centre;
    delete from public.centres  where id = v_centre;
  end if;

  -- ── 3. The centre ─────────────────────────────────────────────────────────
  -- Both codes are credentials, so they are minted the same way the app mints
  -- them rather than being memorable strings. They are printed at the end.
  loop
    v_staff_code := public.secure_code(8);
    exit when not exists (select 1 from public.centres where join_code = v_staff_code
                                                          or student_join_code = v_staff_code);
  end loop;
  loop
    v_stu_code := public.secure_code(8);
    exit when v_stu_code <> v_staff_code
          and not exists (select 1 from public.centres where join_code = v_stu_code
                                                          or student_join_code = v_stu_code);
  end loop;

  insert into public.centres (name, join_code, student_join_code, owner_id)
  values (c_centre, v_staff_code, v_stu_code, v_owner)
  returning id into v_centre;

  insert into public.branches (name, address, is_main, centre_id)
  values ('Maninagar (Main)', '2nd Floor, Rajhans Complex, Maninagar, Ahmedabad 380008', true, v_centre)
  returning id into v_branch;

  update public.profiles
     set role = 'admin', staff_status = 'approved',
         centre_id = v_centre, branch_id = v_branch, updated_at = now()
   where id = v_owner;

  insert into public.batches (name, centre_id) values
    ('Class 9 Morning',  v_centre),
    ('Class 10 Evening', v_centre),
    ('Class 12 Science', v_centre);

  insert into public.subjects (name, centre_id) values
    ('Mathematics',    v_centre),
    ('Science',        v_centre),
    ('English',        v_centre),
    ('Social Science', v_centre),
    ('Physics',        v_centre),
    ('Chemistry',      v_centre),
    ('Biology',        v_centre);

  -- ── 4. Staff ──────────────────────────────────────────────────────────────
  insert into public.teachers (name, subject, experience, qualification, rating, about, branch_id, centre_id)
  values ('Nilesh Patel', 'Mathematics', 11, 'M.Sc., B.Ed.', 4.8,
          'Teaches Class 9 to 12 mathematics. Board-paper drilling in the last term.', v_branch, v_centre)
  returning id into v_t_math;

  insert into public.teachers (name, subject, experience, qualification, rating, about, branch_id, centre_id)
  values ('Priya Shah', 'Science', 7, 'M.Sc. (Physics)', 4.6,
          'Science for Class 9 and 10, Physics and Chemistry for Class 12.', v_branch, v_centre)
  returning id into v_t_sci;

  insert into public.teachers (name, subject, experience, qualification, rating, about, branch_id, centre_id)
  values ('Rakesh Joshi', 'English', 9, 'M.A., B.Ed.', 4.5,
          'English and Social Science. Weekly writing practice.', v_branch, v_centre)
  returning id into v_t_eng;

  -- ── 5. Students ───────────────────────────────────────────────────────────
  -- Joined dates are staggered across the last two years so the roster does
  -- not read as a single import, and last_seen_at is set for most parents so
  -- the reach screen shows real engagement.
  insert into public.students
    (student_code, name, class, batch, school, parent_contact, address,
     status, fee_status, branch_id, centre_id, created_at, last_seen_at)
  select
    r.code, r.name, r.klass, r.batch, r.school, r.parent,
    'Maninagar, Ahmedabad',
    r.status, 'Paid', v_branch, v_centre,
    now() - make_interval(days => (60 + mod(abs(hashtext(r.code)::bigint), 600))::int),
    case when mod(abs(hashtext(r.code || 'seen')::bigint), 10) < 7
         then now() - make_interval(hours => mod(abs(hashtext(r.code || 'h')::bigint), 96)::int)
    end
  from demo_roster r;

  -- ── 6. Timetable ──────────────────────────────────────────────────────────
  -- Six days, two periods a day per class. The subject rotates by weekday so
  -- the grid looks like a timetable somebody actually wrote.
  insert into public.timetable (day, start_time, end_time, subject, class, room, teacher_id, branch_id, centre_id)
  select x.day, x.st, x.en, x.subject, x.klass, x.room,
         case x.subject
           when 'Mathematics' then v_t_math
           when 'English' then v_t_eng
           when 'Social Science' then v_t_eng
           else v_t_sci
         end,
         v_branch, v_centre
  from (
    select d.day, sl.st, sl.en, sl.klass, sl.room,
           sl.subjects[mod(d.n + sl.rot, array_length(sl.subjects, 1)) + 1] as subject
    from (values ('Mon',0),('Tue',1),('Wed',2),('Thu',3),('Fri',4),('Sat',5)) as d(day, n)
    cross join (values
      ('Class 9',  array['Mathematics','Science','English','Social Science'],       '07:00','08:00', 0, 'Room 1'),
      ('Class 9',  array['Science','Social Science','Mathematics','English'],       '08:00','09:00', 0, 'Room 1'),
      ('Class 10', array['Mathematics','Science','English','Social Science'],       '17:00','18:00', 1, 'Room 2'),
      ('Class 10', array['Social Science','Mathematics','Science','English'],       '18:00','19:00', 1, 'Room 2'),
      ('Class 12', array['Physics','Chemistry','Mathematics','Biology'],            '15:30','16:45', 2, 'Room 3'),
      ('Class 12', array['Chemistry','Mathematics','Biology','Physics'],            '16:45','18:00', 2, 'Room 3')
    ) as sl(klass, subjects, st, en, rot, room)
  ) x;

  -- ── 7. Tests and marks ────────────────────────────────────────────────────
  -- Two rounds per subject per class: a 25-mark unit test six weeks back and a
  -- 50-mark one a fortnight ago, so a parent opening the app sees a trend and
  -- not a single number.
  insert into public.tests (name, subject_id, class, max_marks, date, created_by, recorded_by, centre_id)
  select tt.tname, s.id, cs.klass, tt.maxm, current_date - tt.ago,
         case cs.subj when 'Mathematics' then v_t_math
                      when 'English' then v_t_eng
                      when 'Social Science' then v_t_eng
                      else v_t_sci end,
         v_owner, v_centre
  from (values
    ('Class 9','Mathematics'),('Class 9','Science'),('Class 9','English'),('Class 9','Social Science'),
    ('Class 10','Mathematics'),('Class 10','Science'),('Class 10','English'),('Class 10','Social Science'),
    ('Class 12','Physics'),('Class 12','Chemistry'),('Class 12','Mathematics'),('Class 12','Biology')
  ) as cs(klass, subj)
  join public.subjects s on s.centre_id = v_centre and s.name = cs.subj
  cross join (values ('Unit Test 1', 25, 44), ('Unit Test 2', 50, 16)) as tt(tname, maxm, ago);

  -- Ability, plus a deterministic wobble of about eight points either way, so
  -- the same student is recognisably themselves across both rounds without
  -- every mark landing on the same percentage.
  insert into public.results (test_id, student_id, marks, centre_id)
  select t.id, st.id,
         greatest(0, least(t.max_marks,
           round(t.max_marks * (r.ability + mod(abs(hashtext(r.code || t.id::text)::bigint), 17) - 8) / 100.0)
         ))::int,
         v_centre
  from public.tests t
  join public.students st on st.centre_id = v_centre and st.class = t.class and st.status = 'approved'
  join demo_roster r on r.code = st.student_code
  where t.centre_id = v_centre;

  -- ── 8. The register ───────────────────────────────────────────────────────
  -- Sixty days back, Monday to Saturday. Each student turns up as often as
  -- their reliability says, decided by a hash of code+date so the history is
  -- stable across re-runs.
  --
  -- Two students are then forced absent for their last few sessions. That is
  -- the whole reason this seed exists: the head's home screen puts a child who
  -- has missed three sessions in a row in front of you, and there is nothing
  -- to put there unless somebody has stopped coming.
  insert into public.attendance (student_id, date, status, marked_by, recorded_by, centre_id)
  select st.id, d::date,
         case
           when mod(abs(hashtext(r.code || d::text)::bigint), 100) >= r.reliability
             then case when mod(abs(hashtext(d::text || r.code)::bigint), 4) = 0 then 'Leave' else 'Absent' end
           else 'Present'
         end,
         case st.class when 'Class 9' then v_t_math when 'Class 10' then v_t_sci else v_t_eng end,
         v_owner, v_centre
  from public.students st
  join demo_roster r on r.code = st.student_code
  cross join generate_series(current_date - 60, current_date - 1, interval '1 day') d
  where st.centre_id = v_centre
    and st.status = 'approved'
    and extract(isodow from d) between 1 and 6;

  update public.attendance a
     set status = 'Absent'
   where a.centre_id = v_centre
     and a.student_id in (select id from public.students
                           where centre_id = v_centre and student_code in ('DEMO2352','DEMO3463'))
     and a.date in (select distinct date from public.attendance
                     where centre_id = v_centre order by date desc limit 4);

  -- ── 9. Fees ───────────────────────────────────────────────────────────────
  -- Three months. The month before last is settled, last month is settled for
  -- most and overdue for a few, this month is due with a handful already paid.
  insert into public.fees (student_id, amount, period, due_date, paid_date, status, centre_id)
  select st.id,
         case st.class when 'Class 9' then 1200 when 'Class 10' then 1500 else 2200 end,
         to_char(m.month, 'Mon YYYY'),
         m.month + 4,
         case
           when m.n = 2 then m.month + 3
           when m.n = 1 and mod(abs(hashtext(r.code || 'f1')::bigint), 5) <> 0 then m.month + 6
           when m.n = 0 and mod(abs(hashtext(r.code || 'f0')::bigint), 3) = 0 then m.month + 2
         end,
         case
           when m.n = 2 then 'Paid'
           when m.n = 1 then case when mod(abs(hashtext(r.code || 'f1')::bigint), 5) = 0 then 'Overdue' else 'Paid' end
           else case when mod(abs(hashtext(r.code || 'f0')::bigint), 3) = 0 then 'Paid' else 'Due' end
         end,
         v_centre
  from public.students st
  join demo_roster r on r.code = st.student_code
  cross join (values (v_m2, 2), (v_m1, 1), (v_m0, 0)) as m(month, n)
  where st.centre_id = v_centre and st.status = 'approved';

  -- The badge on the roster is the worst thing outstanding, which is what the
  -- app's own fee writes keep it at.
  update public.students st
     set fee_status = case
       when exists (select 1 from public.fees f where f.student_id = st.id and f.status = 'Overdue') then 'Overdue'
       when exists (select 1 from public.fees f where f.student_id = st.id and f.status = 'Due') then 'Due'
       else 'Paid' end
   where st.centre_id = v_centre;

  -- ── 10. Notes and homework ────────────────────────────────────────────────
  insert into public.notes (class, title, subject, body, created_by, centre_id, created_at) values
    ('Class 9',  'Chapter 4 — Linear Equations, worked examples', 'Mathematics', 'Six solved sums covering substitution and elimination. Do the last two yourself before Thursday.', v_owner, v_centre, now() - interval '3 days'),
    ('Class 9',  'Science practical — list of diagrams to learn',  'Science',     'Cell structure, photosynthesis, and the human digestive system. Label everything.',              v_owner, v_centre, now() - interval '9 days'),
    ('Class 10', 'Board paper pattern 2026 — what changed',        'Mathematics', 'Section C is now four marks per question instead of three. Time yourself accordingly.',        v_owner, v_centre, now() - interval '2 days'),
    ('Class 10', 'English — letter writing formats',               'English',     'Formal and informal formats with one example of each. Copy both into your notebook.',          v_owner, v_centre, now() - interval '7 days'),
    ('Class 12', 'Physics — derivations that repeat every year',   'Physics',     'Twelve derivations. If you know these you have thirty marks before the paper starts.',          v_owner, v_centre, now() - interval '1 day'),
    ('Class 12', 'Chemistry — named reactions revision sheet',     'Chemistry',   'One page, forty reactions. Revise it every Sunday until the boards.',                          v_owner, v_centre, now() - interval '5 days');

  insert into public.assignments (title, subject_id, class, due_date, instructions, created_by, recorded_by, centre_id, created_at)
  select a.title, s.id, a.klass, current_date + a.due, a.instr,
         case a.subj when 'Mathematics' then v_t_math when 'English' then v_t_eng else v_t_sci end,
         v_owner, v_centre, now() - make_interval(days => a.made)
  from (values
    ('Class 9',  'Mathematics', 'Exercise 4.3 — all sums',            2, 'Full working. Answers alone will not be checked.',          2),
    ('Class 9',  'Science',     'Draw and label the plant cell',      4, 'A4 sheet, pencil only.',                                    1),
    ('Class 10', 'Mathematics', 'Trigonometry worksheet 2',           1, 'Twenty sums. Bring doubts to Saturday class.',              4),
    ('Class 10', 'English',     'Letter to the editor — 150 words',   3, 'Topic: traffic near the school gate.',                      2),
    ('Class 12', 'Physics',     'Numericals — current electricity',   2, 'Chapter 3, questions 1 to 18.',                             3),
    ('Class 12', 'Chemistry',   'Revision test paper 1',              5, 'Solve at home in ninety minutes, timed.',                   1)
  ) as a(klass, subj, title, due, instr, made)
  join public.subjects s on s.centre_id = v_centre and s.name = a.subj;

  -- ── 11. What the parent's phone has been showing ──────────────────────────
  -- Built from the data above rather than invented, so every line in the feed
  -- is one you can then go and point at on another screen.
  insert into public.notifications (student_id, title, detail, icon, read, centre_id, created_at)
  select r.student_id, r.title, r.detail, r.icon, r.read, v_centre, r.at
  from (
    -- Marks published, for the most recent round.
    select st.id as student_id,
           'Marks published — Unit Test 2' as title,
           sub.name || ' · ' || res.marks || '/' || t.max_marks as detail,
           '📝' as icon, true as read,
           (t.date + interval '18 hours')::timestamptz as at
    from public.results res
    join public.tests t on t.id = res.test_id and t.name = 'Unit Test 2'
    join public.subjects sub on sub.id = t.subject_id
    join public.students st on st.id = res.student_id
    where res.centre_id = v_centre and sub.name in ('Mathematics','Physics')

    union all

    -- Every absence in the last fortnight, which is what the parent is meant
    -- to find out about on the day rather than at the end of the month.
    select st.id,
           'Marked absent',
           to_char(a.date, 'DD Mon') || ' — please let us know if unwell',
           '🚫', a.date < current_date - 3,
           (a.date + interval '11 hours')::timestamptz
    from public.attendance a
    join public.students st on st.id = a.student_id
    where a.centre_id = v_centre and a.status = 'Absent' and a.date >= current_date - 14

    union all

    -- Anything still owed.
    select st.id,
           case f.status when 'Overdue' then 'Fee overdue' else 'Fee due' end,
           '₹' || trim(to_char(f.amount, '99999')) || ' · ' || f.period || ' · due ' || to_char(f.due_date, 'DD Mon'),
           '💰', false,
           (f.due_date - interval '2 days')::timestamptz
    from public.fees f
    join public.students st on st.id = f.student_id
    where f.centre_id = v_centre and f.status <> 'Paid'
  ) r;

  -- ── 12. The head's own week ───────────────────────────────────────────────
  insert into public.meetings (title, meeting_type, date, "time", description, created_by, branch_id, centre_id) values
    ('Parent–teacher meeting — Class 10', 'Parent', current_date + 6, '11:00',
     'Fifteen minutes per parent. Unit Test 2 marks and board preparation.', v_t_sci, v_branch, v_centre),
    ('Staff review — term planning', 'Staff', current_date + 2, '19:30',
     'Syllabus coverage before the next unit test.', v_t_math, v_branch, v_centre);

  insert into public.reminders (type, message, target_class, sent_by, centre_id, created_at) values
    ('Test',     'Unit Test 2 marks are now on the app. Please check your child''s result.', 'Class 10', v_t_sci,  v_centre, now() - interval '15 days'),
    ('Fee',      'This month''s fee is due on the 5th. Please pay at the desk or on UPI.',   null,       v_t_math, v_centre, now() - interval '4 days'),
    ('Homework', 'Trigonometry worksheet 2 is due Monday. Bring your doubts to Saturday class.', 'Class 10', v_t_math, v_centre, now() - interval '1 day');

  raise notice 'Demo centre ready. Staff code %, student join code %.', v_staff_code, v_stu_code;
end
$seed$;


alter table public.students    enable trigger students_start_settled;
alter table public.attendance  enable trigger attendance_stamp_author;
alter table public.tests       enable trigger tests_stamp_author;
alter table public.assignments enable trigger assignments_stamp_author;
alter table public.notes       enable trigger notes_stamp_author;

drop table if exists demo_roster;


-- ─── What to write down before you close this tab ───────────────────────────
select 'Staff join code'   as item, c.join_code         as value, null as note from public.centres c where c.name = 'Shree Vidya Classes (Demo)'
union all
select 'Student join code',        c.student_join_code, null      from public.centres c where c.name = 'Shree Vidya Classes (Demo)'
union all
select 'Students',                 count(*)::text,      'approved + pending'
  from public.students s join public.centres c on c.id = s.centre_id where c.name = 'Shree Vidya Classes (Demo)'
union all
select 'Attendance rows',          count(*)::text,      'last 60 days, Mon-Sat'
  from public.attendance a join public.centres c on c.id = a.centre_id where c.name = 'Shree Vidya Classes (Demo)'
union all
select 'Marks',                    count(*)::text,      '2 rounds x 4 subjects x 3 classes'
  from public.results r join public.centres c on c.id = r.centre_id where c.name = 'Shree Vidya Classes (Demo)'
union all
select 'Fee rows',                 count(*)::text,      '3 months'
  from public.fees f join public.centres c on c.id = f.centre_id where c.name = 'Shree Vidya Classes (Demo)'
union all
select 'Show the parent view as', s.name || ' (' || s.class || ')', s.student_code
  from public.students s join public.centres c on c.id = s.centre_id
  where c.name = 'Shree Vidya Classes (Demo)' and s.student_code in ('DEMO2345','DEMO2352')
order by 1;
