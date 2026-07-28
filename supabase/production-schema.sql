-- ============================================================================
-- SECOND SKOOL — PRODUCTION SCHEMA (canonical, consolidated)
-- ----------------------------------------------------------------------------
-- The complete, current database in ONE idempotent script. Run it on a fresh
-- Supabase project to create everything, OR on your existing DB to verify /
-- top up to the latest state (existing tables are skipped; functions, policies
-- and grants are refreshed). Supersedes: schema.sql, multitenancy.sql,
-- period-and-rollup.sql, security-hardening.sql, rate-limit.sql, notes.sql.
-- Safe to re-run. ⚠️ Back up first if the DB already holds real data.
-- ============================================================================

create extension if not exists "uuid-ossp";

-- ─── CORE TABLES (ordered to avoid the profiles⇄centres circular FK) ─────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','teacher','student')) default 'student',
  staff_status text not null check (staff_status in ('none','pending','approved','rejected')) default 'none',
  head_requested boolean not null default false,
  full_name text not null,
  email text, phone text, avatar_url text,
  branch_id uuid, centre_id uuid,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.centres (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  join_code text unique not null,
  owner_id uuid references public.profiles(id),
  logo_url text,
  created_at timestamptz default now()
);

create table if not exists public.branches (
  id uuid primary key default uuid_generate_v4(),
  name text not null, address text, is_main boolean default false,
  centre_id uuid references public.centres(id),
  created_at timestamptz default now()
);

-- Wire up the deferred FKs on profiles (idempotent).
do $$ begin
  if not exists (select 1 from pg_constraint where conname='profiles_branch_fk') then
    alter table public.profiles add constraint profiles_branch_fk foreign key (branch_id) references public.branches(id);
  end if;
  if not exists (select 1 from pg_constraint where conname='profiles_centre_fk') then
    alter table public.profiles add constraint profiles_centre_fk foreign key (centre_id) references public.centres(id);
  end if;
end $$;

-- current_centre() must exist before tables that default centre_id to it.
create or replace function public.current_centre()
returns uuid language sql security definer stable set search_path = public as $$
  select centre_id from public.profiles where id = auth.uid()
$$;

create table if not exists public.teachers (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid references public.profiles(id) on delete set null,
  name text not null, subject text not null, experience int default 0,
  qualification text, rating numeric(2,1), about text,
  branch_id uuid references public.branches(id),
  centre_id uuid references public.centres(id) default public.current_centre(),
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.students (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid references public.profiles(id) on delete set null,
  student_code text unique not null,
  name text not null, class text not null, school text,
  parent_contact text, address text,
  fee_status text default 'Due' check (fee_status in ('Paid','Due','Overdue')),
  branch_id uuid references public.branches(id),
  centre_id uuid references public.centres(id) default public.current_centre(),
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.subjects (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  centre_id uuid references public.centres(id) default public.current_centre(),
  created_at timestamptz default now()
);

create table if not exists public.tests (
  id uuid primary key default uuid_generate_v4(),
  name text not null, subject_id uuid references public.subjects(id) on delete cascade,
  class text not null, max_marks int not null default 50,
  date date not null default current_date,
  created_by uuid references public.teachers(id),
  recorded_by uuid references public.profiles(id) default auth.uid(),
  centre_id uuid references public.centres(id) default public.current_centre(),
  created_at timestamptz default now()
);

create table if not exists public.results (
  id uuid primary key default uuid_generate_v4(),
  test_id uuid not null references public.tests(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  marks int not null,
  centre_id uuid references public.centres(id) default public.current_centre(),
  created_at timestamptz default now(),
  unique(test_id, student_id)
);

create table if not exists public.attendance (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references public.students(id) on delete cascade,
  date date not null default current_date,
  status text not null check (status in ('Present','Absent','Leave')),
  marked_by uuid references public.teachers(id),
  recorded_by uuid references public.profiles(id) default auth.uid(),
  centre_id uuid references public.centres(id) default public.current_centre(),
  created_at timestamptz default now(),
  unique(student_id, date)
);

create table if not exists public.assignments (
  id uuid primary key default uuid_generate_v4(),
  title text not null, subject_id uuid references public.subjects(id) on delete set null,
  class text not null, due_date date not null, instructions text,
  created_by uuid references public.teachers(id),
  recorded_by uuid references public.profiles(id) default auth.uid(),
  centre_id uuid references public.centres(id) default public.current_centre(),
  created_at timestamptz default now()
);

create table if not exists public.assignment_submissions (
  id uuid primary key default uuid_generate_v4(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  submitted_at timestamptz default now(),
  unique(assignment_id, student_id)
);

create table if not exists public.fees (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references public.students(id) on delete cascade,
  amount numeric(10,2) not null, period text not null,
  due_date date not null, paid_date date,
  status text not null default 'Due' check (status in ('Paid','Due','Overdue')),
  centre_id uuid references public.centres(id) default public.current_centre(),
  created_at timestamptz default now()
);

create table if not exists public.meetings (
  id uuid primary key default uuid_generate_v4(),
  title text not null, meeting_type text, date date not null, time text, description text,
  created_by uuid references public.teachers(id),
  branch_id uuid references public.branches(id),
  centre_id uuid references public.centres(id) default public.current_centre(),
  created_at timestamptz default now()
);

create table if not exists public.reminders (
  id uuid primary key default uuid_generate_v4(),
  type text not null check (type in ('Test','Absence','Fee','Homework')),
  message text not null, target_class text,
  sent_by uuid references public.teachers(id),
  centre_id uuid references public.centres(id) default public.current_centre(),
  created_at timestamptz default now()
);

create table if not exists public.notifications (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references public.students(id) on delete cascade,
  title text not null, detail text, icon text default '🔔', read boolean default false,
  centre_id uuid references public.centres(id) default public.current_centre(),
  created_at timestamptz default now()
);

create table if not exists public.timetable (
  id uuid primary key default uuid_generate_v4(),
  day text not null check (day in ('Mon','Tue','Wed','Thu','Fri','Sat')),
  start_time text not null, end_time text not null,
  subject text not null, class text not null, room text,
  teacher_id uuid references public.teachers(id),
  branch_id uuid references public.branches(id),
  centre_id uuid references public.centres(id) default public.current_centre(),
  created_at timestamptz default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default uuid_generate_v4(),
  branch_id uuid not null references public.branches(id),
  plan text not null check (plan in ('Monthly','Half-yearly','Yearly')),
  price numeric(10,2) not null,
  starts_at date not null default current_date, renews_at date not null,
  status text default 'active' check (status in ('active','cancelled','expired')),
  created_at timestamptz default now()
);

create table if not exists public.attendance_monthly (
  id uuid primary key default uuid_generate_v4(),
  centre_id uuid references public.centres(id),
  student_id uuid not null references public.students(id) on delete cascade,
  month date not null, present int not null default 0, total int not null default 0,
  created_at timestamptz default now(),
  unique(student_id, month)
);

create table if not exists public.code_attempts (
  id bigserial primary key,
  at timestamptz not null default now()
);
create index if not exists code_attempts_at_idx on public.code_attempts (at);
-- user_id scopes join_centre throttling per account (null for anon student-code attempts).
alter table public.code_attempts add column if not exists user_id uuid;

-- One centre per owner: closes the create_centre check-then-insert race.
create unique index if not exists centres_owner_unique on public.centres (owner_id);

-- No duplicate periods; room is part of a period's identity (nulls normalized).
create unique index if not exists timetable_period_room_unique
  on public.timetable (centre_id, day, start_time, end_time, subject, class, coalesce(room,''));

create table if not exists public.notes (
  id uuid primary key default uuid_generate_v4(),
  centre_id uuid references public.centres(id) default public.current_centre(),
  class text not null, title text not null, subject text, body text,
  file_url text, link_url text,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz default now()
);

-- Top-up columns for partially-migrated databases (no-ops on fresh installs).
alter table public.teachers      add column if not exists centre_id uuid references public.centres(id) default public.current_centre();
alter table public.students      add column if not exists centre_id uuid references public.centres(id) default public.current_centre();
alter table public.branches      add column if not exists centre_id uuid references public.centres(id) default public.current_centre();
alter table public.subjects      add column if not exists centre_id uuid references public.centres(id) default public.current_centre();
alter table public.tests         add column if not exists centre_id uuid references public.centres(id) default public.current_centre();
alter table public.results       add column if not exists centre_id uuid references public.centres(id) default public.current_centre();
alter table public.attendance    add column if not exists centre_id uuid references public.centres(id) default public.current_centre();
alter table public.assignments   add column if not exists centre_id uuid references public.centres(id) default public.current_centre();
alter table public.fees          add column if not exists centre_id uuid references public.centres(id) default public.current_centre();
alter table public.meetings      add column if not exists centre_id uuid references public.centres(id) default public.current_centre();
alter table public.reminders     add column if not exists centre_id uuid references public.centres(id) default public.current_centre();
alter table public.notifications add column if not exists centre_id uuid references public.centres(id) default public.current_centre();
alter table public.timetable     add column if not exists centre_id uuid references public.centres(id) default public.current_centre();
alter table public.attendance    add column if not exists recorded_by uuid references public.profiles(id) default auth.uid();
alter table public.tests         add column if not exists recorded_by uuid references public.profiles(id) default auth.uid();
alter table public.assignments   add column if not exists recorded_by uuid references public.profiles(id) default auth.uid();
-- White-label: head-set centre logo (small data-URL) shown to students on login.
alter table public.centres       add column if not exists logo_url text;

-- Subject deletes must propagate: a removed subject takes its tests/results
-- with it (cascade); assignments survive but drop the subject label (set null).
alter table public.tests alter column subject_id drop not null;
alter table public.tests drop constraint if exists tests_subject_id_fkey;
alter table public.tests add constraint tests_subject_id_fkey foreign key (subject_id) references public.subjects(id) on delete cascade;
alter table public.assignments drop constraint if exists assignments_subject_id_fkey;
alter table public.assignments add constraint assignments_subject_id_fkey foreign key (subject_id) references public.subjects(id) on delete set null;

-- ─── HELPER FUNCTIONS ────────────────────────────────────────────────────────
create or replace function public.is_head()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles where id=auth.uid() and role='admin' and staff_status='approved') $$;
create or replace function public.is_staff()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles where id=auth.uid() and role in ('admin','teacher') and staff_status='approved') $$;
create or replace function public.head_exists()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles where centre_id=public.current_centre() and role='admin' and staff_status='approved') $$;

-- ─── REGISTRATION / CENTRE RPCs ──────────────────────────────────────────────
create or replace function public.create_centre(p_name text)
returns json language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_code text;
begin
  if length(coalesce(trim(p_name),'')) < 2 or length(trim(p_name)) > 80 then raise exception 'Enter a centre name (2-80 characters)'; end if;
  if (select centre_id from public.profiles where id=auth.uid()) is not null then raise exception 'You already belong to a centre'; end if;
  loop v_code := upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)); exit when not exists (select 1 from public.centres where join_code=v_code); end loop;
  begin
    insert into public.centres (name, join_code, owner_id) values (trim(p_name), v_code, auth.uid()) returning id into v_id;
  exception when unique_violation then
    raise exception 'You already created a centre';
  end;
  update public.profiles set role='admin', staff_status='approved', centre_id=v_id, head_requested=false where id=auth.uid();
  return json_build_object('centre_id',v_id,'join_code',v_code,'name',trim(p_name));
end; $$;

create or replace function public.join_centre(p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_name text;
begin
  -- Per-account throttle: 5 failed code attempts per 15 minutes.
  delete from public.code_attempts where at < now() - interval '15 minutes';
  if (select count(*) from public.code_attempts
      where user_id = auth.uid() and at > now() - interval '15 minutes') >= 5 then
    raise exception 'Too many attempts — try again in 15 minutes';
  end if;
  select id, name into v_id, v_name from public.centres where join_code=upper(trim(coalesce(p_code,'')));
  if v_id is null then
    insert into public.code_attempts (user_id) values (auth.uid());
    raise exception 'Invalid centre code';
  end if;
  if (select centre_id from public.profiles where id=auth.uid()) is not null then raise exception 'You already belong to a centre'; end if;
  update public.profiles set role='teacher', staff_status='pending', centre_id=v_id where id=auth.uid();
  return json_build_object('centre_id',v_id,'name',v_name);
end; $$;

create or replace function public.my_centre()
returns json language plpgsql security definer set search_path = public as $$
declare v json;
begin select json_build_object('name',c.name,'join_code',c.join_code,'logo_url',c.logo_url) into v from public.centres c where c.id=public.current_centre(); return v; end; $$;

-- ─── STAFF MANAGEMENT (head only, own centre) ────────────────────────────────
create or replace function public.approve_teacher(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin if not public.is_head() then raise exception 'Not authorized'; end if;
  update public.profiles set role='teacher', staff_status='approved' where id=p_id and centre_id=public.current_centre(); end; $$;
create or replace function public.reject_teacher(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin if not public.is_head() then raise exception 'Not authorized'; end if;
  -- Free the account (clear centre_id) so a declined teacher can join another
  -- centre later instead of being permanently stuck on the "denied" screen.
  update public.profiles set role='student', staff_status='rejected', centre_id=null, head_requested=false where id=p_id and centre_id=public.current_centre(); end; $$;
create or replace function public.grant_head(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin if not public.is_head() then raise exception 'Not authorized'; end if;
  update public.profiles set role='admin', staff_status='approved', head_requested=false where id=p_id and centre_id=public.current_centre(); end; $$;
create or replace function public.remove_staff(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin if not public.is_head() then raise exception 'Not authorized'; end if;
  if p_id = auth.uid() then raise exception 'You cannot remove yourself'; end if;
  update public.profiles set role='student', staff_status='rejected', centre_id=null, head_requested=false where id=p_id and centre_id=public.current_centre(); end; $$;

-- ─── REPORTS (head only, own centre, p_days window) ──────────────────────────
create or replace function public.weekly_branch_report(p_days int default 7)
returns json language plpgsql security definer set search_path = public as $$
declare v_result json; v_since timestamptz := now() - make_interval(days => p_days); v_date_since date := current_date - p_days; v_c uuid := public.current_centre();
begin
  if not public.is_head() then raise exception 'Not authorized'; end if;
  select json_build_object('generated_at', now(),
    'branches', coalesce((select json_agg(json_build_object(
      'name', b.name,
      'students', (select count(*) from public.students s where s.branch_id=b.id),
      'new_students', (select count(*) from public.students s where s.branch_id=b.id and s.created_at>=v_since),
      'staff', (select count(*) from public.teachers t where t.branch_id=b.id),
      'att_pct', (select coalesce(round(count(*) filter (where a.status='Present')::numeric/nullif(count(*),0)*100),0)::int from public.attendance a join public.students s on s.id=a.student_id where s.branch_id=b.id and a.date>=v_date_since),
      'fees_collected', (select coalesce(sum(f.amount),0)::bigint from public.fees f join public.students s on s.id=f.student_id where s.branch_id=b.id and f.status='Paid' and f.paid_date>=v_date_since),
      'fees_pending', (select coalesce(sum(f.amount),0)::bigint from public.fees f join public.students s on s.id=f.student_id where s.branch_id=b.id and f.status<>'Paid')
    ) order by b.is_main desc, b.name) from public.branches b where b.centre_id=v_c),'[]'::json),
    'unassigned_students', (select count(*) from public.students where branch_id is null and centre_id=v_c),
    'tests_this_week', (select count(*) from public.tests where date>=v_date_since and centre_id=v_c)
  ) into v_result; return v_result;
end; $$;

create or replace function public.weekly_student_reports(p_days int default 7)
returns json language plpgsql security definer set search_path = public as $$
declare v_result json; v_date_since date := current_date - p_days; v_c uuid := public.current_centre();
begin
  if not public.is_head() then raise exception 'Not authorized'; end if;
  select coalesce(json_agg(json_build_object(
    'name', s.name, 'klass', s.class, 'parent', s.parent_contact, 'fee_status', s.fee_status,
    'att_present', (select count(*) from public.attendance a where a.student_id=s.id and a.date>=v_date_since and a.status='Present'),
    'att_total', (select count(*) from public.attendance a where a.student_id=s.id and a.date>=v_date_since),
    'tests', (select count(*) from public.results r join public.tests t on t.id=r.test_id where r.student_id=s.id and t.date>=v_date_since),
    'avg_pct', (select coalesce(round(sum(r.marks)::numeric/nullif(sum(t.max_marks),0)*100),0)::int from public.results r join public.tests t on t.id=r.test_id where r.student_id=s.id and t.date>=v_date_since)
  ) order by s.name),'[]'::json) into v_result from public.students s where s.centre_id=v_c;
  return v_result;
end; $$;

create or replace function public.weekly_teacher_activity(p_days int default 7)
returns json language plpgsql security definer set search_path = public as $$
declare v_result json; v_since timestamptz := now() - make_interval(days => p_days); v_c uuid := public.current_centre();
begin
  if not public.is_head() then raise exception 'Not authorized'; end if;
  select coalesce(json_agg(json_build_object(
    'name', p.full_name, 'email', p.email, 'is_head', (p.role='admin'),
    'attendance_marks', (select count(*) from public.attendance a where a.recorded_by=p.id and a.created_at>=v_since),
    'tests_entered', (select count(*) from public.tests t where t.recorded_by=p.id and t.created_at>=v_since),
    'assignments_created', (select count(*) from public.assignments ag where ag.recorded_by=p.id and ag.created_at>=v_since)
  ) order by (p.role='admin') desc, p.full_name),'[]'::json) into v_result
  from public.profiles p where p.staff_status='approved' and p.role in ('admin','teacher') and p.centre_id=v_c;
  return v_result;
end; $$;

-- ─── STUDENT (anon, code-scoped) ─────────────────────────────────────────────
create or replace function public.get_student_snapshot(p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare v_student public.students; v_result json; v_c uuid; v_fails int;
begin
  if length(coalesce(p_code,'')) < 4 then return null; end if;
  select * into v_student from public.students where student_code = p_code;
  if v_student.id is null then
    select count(*) into v_fails from public.code_attempts where at > now() - interval '1 minute';
    if v_fails >= 25 then raise exception 'Too many attempts — please try again in a minute'; end if;
    insert into public.code_attempts default values;
    delete from public.code_attempts where at < now() - interval '5 minutes';
    return null;
  end if;
  v_c := v_student.centre_id;
  select json_build_object(
    'student', json_build_object('dbId',v_student.id,'name',v_student.name,'klass',v_student.class,'school',v_student.school,'code',v_student.student_code,'parent',v_student.parent_contact,'address',v_student.address,'feeStatus',v_student.fee_status),
    'centre', (select json_build_object('name',c.name,'logo_url',c.logo_url) from public.centres c where c.id=v_c),
    'attendance', coalesce((select json_agg(json_build_object('date',a.date,'status',a.status) order by a.date desc) from public.attendance a where a.student_id=v_student.id),'[]'::json),
    'results', coalesce((select json_agg(json_build_object('subject',s.name,'test',t.name,'date',t.date,'marks',r.marks,'total',t.max_marks) order by t.date desc) from public.results r join public.tests t on t.id=r.test_id join public.subjects s on s.id=t.subject_id where r.student_id=v_student.id),'[]'::json),
    'fees', coalesce((select json_agg(json_build_object('period',f.period,'amount',f.amount,'status',f.status,'dueDate',f.due_date,'paidDate',f.paid_date) order by f.due_date desc) from public.fees f where f.student_id=v_student.id),'[]'::json),
    'notifications', coalesce((select json_agg(json_build_object('title',n.title,'detail',n.detail,'icon',n.icon,'createdAt',n.created_at) order by n.created_at desc) from public.notifications n where n.student_id=v_student.id),'[]'::json),
    'teachers', coalesce((select json_agg(json_build_object('name',te.name,'subject',te.subject,'experience',te.experience,'qualification',te.qualification,'rating',te.rating,'about',te.about) order by te.created_at desc) from public.teachers te where te.centre_id=v_c),'[]'::json),
    'rankings', coalesce((select json_object_agg(subject,arr) from (select subject, json_agg(json_build_array(name,pct) order by pct desc) as arr from (select s.name as subject, st.name as name, round(sum(r.marks)::numeric/nullif(sum(t.max_marks),0)*100)::int as pct from public.results r join public.tests t on t.id=r.test_id join public.subjects s on s.id=t.subject_id join public.students st on st.id=r.student_id where st.centre_id=v_c group by s.name, st.name) per_student group by subject) ranked),'{}'::json),
    'timetable', coalesce((select json_agg(json_build_object('day',tt.day,'start',tt.start_time,'end',tt.end_time,'subject',tt.subject,'room',tt.room) order by tt.start_time) from public.timetable tt where tt.class=v_student.class and tt.centre_id=v_c),'[]'::json),
    'assignments', coalesce((select json_agg(json_build_object('title',ag.title,'subject',sub.name,'due',ag.due_date,'instructions',ag.instructions) order by ag.due_date desc) from public.assignments ag left join public.subjects sub on sub.id=ag.subject_id where ag.class=v_student.class and ag.centre_id=v_c),'[]'::json)
  ) into v_result;
  return v_result;
end; $$;

create or replace function public.get_student_notes(p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare v_student public.students;
begin
  if length(coalesce(p_code,'')) < 4 then return '[]'::json; end if;
  select * into v_student from public.students where student_code = p_code;
  if v_student.id is null then return '[]'::json; end if;
  return coalesce((select json_agg(json_build_object('title',n.title,'subject',n.subject,'body',n.body,'fileUrl',n.file_url,'linkUrl',n.link_url,'date',n.created_at) order by n.created_at desc)
    from public.notes n where n.class=v_student.class and n.centre_id=v_student.centre_id),'[]'::json);
end; $$;

create or replace function public.update_student_self(p_code text, p_name text, p_parent text, p_address text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if length(coalesce(p_code,'')) < 4 or length(p_code) > 40 then raise exception 'Invalid code'; end if;
  update public.students set
    name = coalesce(nullif(left(trim(p_name),100),''), name),
    parent_contact = coalesce(nullif(left(trim(p_parent),30),''), parent_contact),
    address = coalesce(nullif(left(trim(p_address),300),''), address)
  where student_code = p_code;
end; $$;

-- ─── MAINTENANCE ─────────────────────────────────────────────────────────────
create or replace function public.archive_old_attendance()
returns text language plpgsql security definer set search_path = public as $$
declare v_rows int;
begin
  insert into public.attendance_monthly (centre_id, student_id, month, present, total)
  select a.centre_id, a.student_id, date_trunc('month', a.date)::date,
         count(*) filter (where a.status='Present'), count(*)
  from public.attendance a where a.date < current_date - 90
  group by a.centre_id, a.student_id, date_trunc('month', a.date)
  on conflict (student_id, month) do update
    set present = public.attendance_monthly.present + excluded.present,
        total   = public.attendance_monthly.total   + excluded.total;
  delete from public.attendance where date < current_date - 90;
  get diagnostics v_rows = row_count;
  return 'archived ' || v_rows || ' daily attendance rows';
end; $$;

-- ─── TRIGGERS ────────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email, role, staff_status)
  values (new.id, left(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),120), new.email, 'student', 'none');
  return new;
end; $$ language plpgsql security definer set search_path = public;
create or replace trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger as $$ begin new.updated_at = now(); return new; end; $$ language plpgsql set search_path = public;
create or replace trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create or replace trigger teachers_updated_at before update on public.teachers for each row execute function public.set_updated_at();
create or replace trigger students_updated_at before update on public.students for each row execute function public.set_updated_at();

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────────────────────
do $$ declare t text; begin
  foreach t in array array['profiles','centres','branches','teachers','students','attendance','subjects','tests','results','assignments','assignment_submissions','fees','meetings','reminders','notifications','timetable','subscriptions','attendance_monthly','code_attempts','notes']
  loop execute format('alter table public.%I enable row level security', t); end loop;
end $$;

-- Drop every existing policy on these tables, then recreate the canonical set.
do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname='public'
    and tablename in ('profiles','centres','branches','teachers','students','attendance','subjects','tests','results','assignments','assignment_submissions','fees','meetings','reminders','notifications','timetable','subscriptions','attendance_monthly','code_attempts','notes')
  loop execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename); end loop;
end $$;

create policy centres_read on public.centres for select to authenticated using (id = public.current_centre());
create policy centres_write on public.centres for update to authenticated using (owner_id = auth.uid());

create policy profiles_read on public.profiles for select to authenticated using (id = auth.uid() or (public.is_head() and centre_id = public.current_centre()));
create policy profiles_update_self on public.profiles for update to authenticated using (id = auth.uid());
create policy profiles_insert_self on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update_head on public.profiles for update to authenticated using (public.is_head() and centre_id = public.current_centre());

create policy students_staff    on public.students    for all to authenticated using (public.is_staff() and centre_id=public.current_centre()) with check (public.is_staff() and centre_id=public.current_centre());
create policy attendance_staff  on public.attendance  for all to authenticated using (public.is_staff() and centre_id=public.current_centre()) with check (public.is_staff() and centre_id=public.current_centre());
create policy tests_staff       on public.tests       for all to authenticated using (public.is_staff() and centre_id=public.current_centre()) with check (public.is_staff() and centre_id=public.current_centre());
create policy results_staff     on public.results     for all to authenticated using (public.is_staff() and centre_id=public.current_centre()) with check (public.is_staff() and centre_id=public.current_centre());
create policy assignments_staff on public.assignments for all to authenticated using (public.is_staff() and centre_id=public.current_centre()) with check (public.is_staff() and centre_id=public.current_centre());
create policy reminders_staff   on public.reminders   for all to authenticated using (public.is_staff() and centre_id=public.current_centre()) with check (public.is_staff() and centre_id=public.current_centre());
create policy notifs_staff      on public.notifications for all to authenticated using (public.is_staff() and centre_id=public.current_centre()) with check (public.is_staff() and centre_id=public.current_centre());
create policy timetable_staff   on public.timetable   for all to authenticated using (public.is_staff() and centre_id=public.current_centre()) with check (public.is_staff() and centre_id=public.current_centre());
create policy notes_staff       on public.notes       for all to authenticated using (public.is_staff() and centre_id=public.current_centre()) with check (public.is_staff() and centre_id=public.current_centre());

create policy teachers_head  on public.teachers  for all to authenticated using (public.is_head() and centre_id=public.current_centre()) with check (public.is_head() and centre_id=public.current_centre());
create policy branches_head  on public.branches  for all to authenticated using (public.is_head() and centre_id=public.current_centre()) with check (public.is_head() and centre_id=public.current_centre());
create policy subjects_head  on public.subjects  for all to authenticated using (public.is_head() and centre_id=public.current_centre()) with check (public.is_head() and centre_id=public.current_centre());
create policy fees_head      on public.fees      for all to authenticated using (public.is_head() and centre_id=public.current_centre()) with check (public.is_head() and centre_id=public.current_centre());
create policy meetings_head  on public.meetings  for all to authenticated using (public.is_head() and centre_id=public.current_centre()) with check (public.is_head() and centre_id=public.current_centre());

create policy teachers_read  on public.teachers  for select to authenticated using (public.is_staff() and centre_id=public.current_centre());
create policy branches_read  on public.branches  for select to authenticated using (public.is_staff() and centre_id=public.current_centre());
create policy subjects_read  on public.subjects  for select to authenticated using (public.is_staff() and centre_id=public.current_centre());
create policy fees_read      on public.fees      for select to authenticated using (public.is_staff() and centre_id=public.current_centre());
create policy meetings_read  on public.meetings  for select to authenticated using (public.is_staff() and centre_id=public.current_centre());
create policy att_monthly_read on public.attendance_monthly for select to authenticated using (public.is_staff() and centre_id=public.current_centre());
-- subscriptions + code_attempts: no policies => only SECURITY DEFINER paths touch them.

-- ─── COLUMN-LEVEL PRIVILEGES (block self-privilege-escalation) ───────────────
revoke insert, update on public.profiles from authenticated;
grant update (full_name, phone, avatar_url) on public.profiles to authenticated;
revoke update on public.centres from authenticated;
grant update (name) on public.centres to authenticated;
revoke all on public.subscriptions from authenticated, anon;

-- ─── FUNCTION GRANTS ─────────────────────────────────────────────────────────
revoke all on function public.current_centre() from public, anon;
revoke all on function public.is_head(), public.is_staff() from public, anon;
revoke all on function public.head_exists() from public, anon;
revoke all on function public.create_centre(text), public.join_centre(text), public.my_centre() from public, anon;
revoke all on function public.approve_teacher(uuid), public.reject_teacher(uuid), public.grant_head(uuid), public.remove_staff(uuid) from public, anon;
revoke all on function public.weekly_branch_report(int), public.weekly_student_reports(int), public.weekly_teacher_activity(int) from public, anon;
revoke all on function public.archive_old_attendance() from public, anon, authenticated;
revoke all on function public.get_student_snapshot(text), public.get_student_notes(text), public.update_student_self(text,text,text,text) from public;

grant execute on function public.current_centre() to authenticated;
grant execute on function public.is_head(), public.is_staff() to authenticated;
grant execute on function public.head_exists() to authenticated;
grant execute on function public.create_centre(text), public.join_centre(text), public.my_centre() to authenticated;
grant execute on function public.approve_teacher(uuid), public.reject_teacher(uuid), public.grant_head(uuid), public.remove_staff(uuid) to authenticated;
grant execute on function public.weekly_branch_report(int), public.weekly_student_reports(int), public.weekly_teacher_activity(int) to authenticated;
grant execute on function public.get_student_snapshot(text), public.get_student_notes(text), public.update_student_self(text,text,text,text) to anon, authenticated;

-- ─── STORAGE (notes files) ───────────────────────────────────────────────────
insert into storage.buckets (id, name, public) values ('notes','notes',true) on conflict (id) do nothing;
drop policy if exists "notes files public read" on storage.objects;   -- no listing
drop policy if exists "notes files staff upload" on storage.objects;
drop policy if exists "notes files staff delete" on storage.objects;
create policy "notes files staff upload" on storage.objects for insert to authenticated with check (bucket_id='notes' and public.is_staff());
create policy "notes files staff delete" on storage.objects for delete to authenticated using (bucket_id='notes' and public.is_staff());

-- ─── REALTIME (pending-teacher auto-advance / live approvals) ────────────────
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='profiles') then
    alter publication supabase_realtime add table public.profiles;
  end if;
end $$;
