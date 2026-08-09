-- Staff fill in their own profile after signing in.
--
-- Until now full_name came straight from Google's OAuth metadata via
-- handle_new_user(), so a teacher's name in the app was whatever their Google
-- account happened to say — often an alias, a first name only, or an email
-- prefix. The head teacher then had no phone number and no idea what the
-- person actually teaches.
--
-- This adds the fields a tuition centre actually needs, plus a completion
-- marker so the app can require the details once and never nag again.
--
-- Safe to re-run.

alter table public.profiles
  add column if not exists subject text,
  add column if not exists qualification text,
  add column if not exists profile_completed_at timestamptz;

-- Bound the free-text fields. Without this a client can write megabytes into
-- a column that gets rendered on the staff list.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_subject_len') then
    alter table public.profiles add constraint profiles_subject_len check (subject is null or char_length(subject) <= 120);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_qualification_len') then
    alter table public.profiles add constraint profiles_qualification_len check (qualification is null or char_length(qualification) <= 120);
  end if;
end $$;

-- Anyone already approved and working has effectively completed onboarding.
-- Marking them done keeps this migration invisible to existing staff instead
-- of throwing a setup form at people mid-term.
update public.profiles
   set profile_completed_at = now()
 where profile_completed_at is null
   and staff_status = 'approved';

-- Column-level grants, matching security-hardening.sql: a user may edit these
-- fields on their own row (enforced by the profiles_update_self policy) and
-- nothing else. role, staff_status and centre_id stay unwritable from the
-- client, so this cannot be used to self-approve or switch centres.
grant update (full_name, phone, avatar_url, subject, qualification, profile_completed_at)
  on public.profiles to authenticated;
