-- Installment plans.
--
-- A plan is not a new kind of thing. Six monthly installments are six ordinary
-- fee rows, which is why there is no fee_plans table here: every screen, policy
-- and report that already understands a fee row understands an installment for
-- free, and a plan cannot drift out of sync with the rows it supposedly
-- describes because it is nothing but those rows.
--
-- The one thing the rows cannot say by themselves is which of them were created
-- together. That matters exactly once — when a head sets up the wrong plan and
-- wants all six gone in one tap instead of confirming six deletes. Hence one
-- nullable column and nothing else.
--
-- Null means an ad-hoc fee, which is what every existing row is.

alter table public.fees add column if not exists plan_id uuid;

-- Only plan rows are ever looked up this way; a partial index keeps the
-- ad-hoc rows, which are the majority, out of it.
create index if not exists fees_plan_idx on public.fees (plan_id) where plan_id is not null;

-- ---------------------------------------------------------------------------
-- Record this migration as applied. Keep this block last in every file. Added
-- late — this file shipped without it, so a database that already had plan_id
-- still reported 0026 as never run.
-- ---------------------------------------------------------------------------
insert into public.schema_migrations (version) values ('0026_fee_plans')
  on conflict (version) do nothing;
