-- ============================================================================
-- SELF-VERIFYING TEST — secure_code (audit fix H1)
-- Run AFTER migrations/0007_audit_hardening.sql, in the Supabase SQL editor.
-- No pgTAP, no setup:
-- each check RAISEs on failure; a clean run prints "secure_code: ALL PASSED".
-- ============================================================================
do $$
declare
  v_code text;
  v_alpha constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_seen text[] := '{}';
  i int;
begin
  -- 1) Correct length for a range of sizes.
  for i in 1..12 loop
    if length(public.secure_code(i)) <> i then
      raise exception 'FAIL: secure_code(%) wrong length', i;
    end if;
  end loop;

  -- 2) Only the confusable-free alphabet — no O/0/I/1/L, no lowercase/symbols.
  for i in 1..500 loop
    v_code := public.secure_code(10);
    if v_code ~ '[^ABCDEFGHJKMNPQRSTUVWXYZ23456789]' then
      raise exception 'FAIL: secure_code produced out-of-alphabet char: %', v_code;
    end if;
    if v_code ~ '[O0I1L]' then
      raise exception 'FAIL: secure_code produced a confusable char: %', v_code;
    end if;
  end loop;

  -- 3) Uniqueness sanity — 2000 draws of an 8-char code must not collide
  --    (a stuck / low-entropy RNG would fail here).
  for i in 1..2000 loop
    v_code := public.secure_code(8);
    if v_code = any(v_seen) then
      raise exception 'FAIL: secure_code collision within 2000 draws: %', v_code;
    end if;
    v_seen := array_append(v_seen, v_code);
  end loop;

  -- 4) Every alphabet character is reachable (distribution isn't stuck on a
  --    subset) — across many draws we should see all 31 symbols at least once.
  declare v_bag text := ''; c char;
  begin
    for i in 1..4000 loop v_bag := v_bag || public.secure_code(4); end loop;
    for i in 1..length(v_alpha) loop
      c := substr(v_alpha, i, 1);
      if position(c in v_bag) = 0 then
        raise exception 'FAIL: character % never appeared across 16000 chars', c;
      end if;
    end loop;
  end;

  raise notice 'secure_code: ALL PASSED';
end $$;
