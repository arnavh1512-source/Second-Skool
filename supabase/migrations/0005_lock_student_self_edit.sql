-- ============================================================================
-- LOCK STUDENT SELF-EDIT — Second Skool
-- Students may VIEW their profile but never change it. Only the head teacher
-- edits a student record (Students → Edit Student, RLS-gated by is_staff()).
-- This removes the anon/authenticated self-update RPC entirely so a code-only
-- student can no longer patch their own name / parent / address.
-- Idempotent.
-- ============================================================================

revoke all on function public.update_student_self(text, text, text, text) from anon, authenticated;
drop function if exists public.update_student_self(text, text, text, text);

-- ---------------------------------------------------------------------------
-- Record this migration as applied. Keep this block last in every file.
-- ---------------------------------------------------------------------------
insert into public.schema_migrations (version) values ('0005_lock_student_self_edit')
  on conflict (version) do nothing;
