<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# How this project is worked on

Second Skool is a single-page PWA for Indian tuition centres. One Next.js app,
one Supabase project, three roles that share the same screens (head, teacher,
student) and an operator console that sits outside them. Read this before
touching anything — it is the part of the shape the code does not say out loud.

## Where things live

| Path | What lives there |
|---|---|
| `app/page.tsx` | the whole router — every screen is a lazy `dyn()` entry in one switch |
| `app/components/*Screens.tsx` | screens, grouped by area, not one file per screen |
| `app/store/slices/*` | zustand slices; `store.ts` composes them, `types.ts` + `initial-state.ts` declare them |
| `app/lib/*` | anything with no React in it — validation, formatting, supabase clients, push |
| `app/globals.css` | **every colour in the app.** Components use `td-*` tokens; a literal hex in a component is a bug |
| `supabase/migrations/*.sql` | schema, numbered, append-only |
| `tests/*.test.ts` | vitest, pure logic only — no DOM, no network |

## Rules that are not obvious from the code

- **Students have no auth session.** Identity is a `student_code` in
  localStorage, and every student read goes through an anon `security definer`
  RPC. Never assume `auth.uid()` on a student path.
- **The operator owns no centre.** Operator UI lives outside the role gates in
  `page.tsx` and reaches the database through `app/api/dev` with the service
  role key — which is server-only and must never gain a `NEXT_PUBLIC_` prefix.
- **No zod.** Boundaries are hand-validated in `app/lib/*`. That is the
  convention here and it stays that way.
- **Colours come from tokens.** `globals.css` defines light and dark values for
  one set of `--color-td-*` names, and `data-theme` on `<html>` picks which.
  A hardcoded colour is a pixel that cannot follow the theme.
- **A feature that costs teacher data entry is not a feature.** Adoption is the
  bottleneck, not capability. If it needs a teacher to type something new every
  day, it does not ship.
- **Agents never write to the live database.** Migrations are `.sql` files the
  human runs in the Supabase SQL editor. Read-only verification is fine.

## Before every commit

Run all four, and read the exit codes directly — never through a pipe, because
`npm run build | tail` reports the exit status of `tail`, not of the build:

```bash
npx tsc --noEmit; echo "TSC=$?"
npm run lint;     echo "LINT=$?"
npx vitest run;   echo "TEST=$?"
npm run build;    echo "BUILD=$?"
```

All four must be `0`. Nothing gets pushed on a red build.

Then run **ponytail** over the diff — the `ponytail-review` skill, or
`ponytail-audit` for the whole tree. It is a separate pass on purpose: the four
commands above prove the code works, ponytail asks whether it needed to exist.
It tags what to cut:

| tag | means |
|---|---|
| `delete:` | dead code, unused flexibility, a feature nobody asked for |
| `stdlib:` | a hand-rolled thing the standard library already ships |
| `native:` | a dependency doing what the platform already does |
| `yagni:` | an abstraction with one implementation, config nobody sets |
| `shrink:` | same logic, fewer lines |

Act on the findings before committing, not after. Correctness, security and
performance are out of ponytail's scope — those belong to the four commands
and to a normal review pass.

Commit messages say what changed in plain English, in the style already in the
log (`fix: the head never heard about a student waiting for approval`). Commit
and push without asking.
