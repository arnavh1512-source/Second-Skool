-- ============================================================================
-- HOTFIX — "function gen_random_bytes(integer) does not exist"
-- ----------------------------------------------------------------------------
-- Root cause: on Supabase, pgcrypto lives in the `extensions` schema, not
-- `public`. secure_code() ran under the caller's `search_path = public`, so
-- gen_random_bytes() could not be resolved and create_centre / student_signup
-- failed in production.
--
-- Fix: pin secure_code()'s own search_path to include `extensions`. Nothing
-- else changes — the callers already reference public.secure_code(). Idempotent;
-- safe to run in production. Run this in the Supabase SQL editor.
-- ============================================================================

create extension if not exists pgcrypto;

create or replace function public.secure_code(p_len int)
returns text language plpgsql
set search_path = public, extensions, pg_temp as $$
declare
  v_alpha constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- 31 chars, no O/0/I/1/L
  v_n     constant int  := 31;
  v_cap   constant int  := (256 / v_n) * v_n;  -- 248: largest unbiased byte range
  v_out   text := '';
  v_byte  int;
begin
  while length(v_out) < p_len loop
    v_byte := get_byte(gen_random_bytes(1), 0);
    if v_byte < v_cap then
      v_out := v_out || substr(v_alpha, 1 + (v_byte % v_n), 1);
    end if;
  end loop;
  return v_out;
end; $$;

revoke all on function public.secure_code(int) from public, anon, authenticated;

-- Verify immediately — should print a 6-char code with no error.
do $$ begin raise notice 'secure_code hotfix OK: %', public.secure_code(6); end $$;

-- ---------------------------------------------------------------------------
-- Record this migration as applied. Keep this block last in every file.
-- ---------------------------------------------------------------------------
insert into public.schema_migrations (version) values ('0008_audit_hardening_search_path')
  on conflict (version) do nothing;
