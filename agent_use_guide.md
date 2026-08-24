# Agent Use Guide — `.claude/` quick reference

How to get the most out of this repo's skills, commands, and agents. Backend = Django DDD/Hexagonal under
`backend/` (rules in [backend/CLAUDE.md](backend/CLAUDE.md), auto-loaded when you touch backend files).
Frontend = React 19 DDD-mirrored under `frontend/` (rules in [frontend/CLAUDE.md](frontend/CLAUDE.md),
auto-loaded when you touch frontend files).

> **Bootstrap status.** These skills, commands and agents are the `Logistics` harness, verbatim, with the
> Django package renamed (`logistics` -> `proyecto3`). They cite reference files — `AssetType`, `Role`, the
> `customers` module — that **do not exist in Proyecto3 yet**. Resolve every such citation against the
> sibling repo `../Logistics`, and rename `logistics.apps.<app>` to `proyecto3.apps.<app>` as you copy.
> Once Proyecto3 has its own reference model, update this file and drop this note.

---

## Backend

### Golden path — add a new model/endpoint

```
/new-model <Model> <app> [tenant|global]      # e.g. /new-model Warehouse companies tenant
```

It runs: **ddd-feature-planner** (plan) → you approve → **ddd-new-model** skill (implement all layers) →
**ddd-view-tests** skill (tests) → `/backend-check` → `/backend-migrate` → **ddd-architecture-reviewer** (audit).
Or do the steps yourself with the pieces below.

### Commands (you type these)

| Command | When | Notes |
| --- | --- | --- |
| `/backend-check [path]` | before committing | ruff format+lint, mypy strict, django check |
| `/backend-test [path]` | after changing code/tests | auto `--no-cov` for one file; no arg = full suite + coverage |
| `/backend-migrate [app]` | after a model/schema change | needs Postgres up (docker compose); commit the migration |
| `/new-model <Model> <app>` | new resource | full scaffold workflow (above) |

### Skills (auto-trigger by what you ask; no need to name them)

| Skill | Say something like | Gives you |
| --- | --- | --- |
| `ddd-new-model` | "add a Warehouse model to companies" | ordered per-layer procedure + copy-paste templates (`reference.md`) |
| `ddd-view-tests` | "write tests for the X view" | the 5 test classes + RBAC/isolation/lifecycle/filter matrix |
| `ddd-domain-errors` | "this returns 500, should be 400" / "add a business-rule error" | DomainError pattern + the global-handler mechanism |
| `ddd-seeding` | "seed sample data for X" / "add an initdb generator" | generator + `initdb`/`cleandb` wiring |

### Agents (delegate focused work; read-only)

| Agent | Use for | Output |
| --- | --- | --- |
| `ddd-feature-planner` | design before coding a new model | per-layer file list + signatures + test matrix |
| `ddd-architecture-reviewer` | audit a diff before committing | categorized violations (boundaries, views, errors, symmetry, tests) |

Invoke by asking, e.g. "use the ddd-architecture-reviewer on my changes" or "have the ddd-feature-planner design X".

### Common one-offs → what to reach for

- **Fix a failing/`500` test** → `ddd-domain-errors` skill (it's usually a leaked raw error in a service/entity), then `/backend-test <file>`.
- **Just run a check** → `/backend-check` (whole or a path).
- **New custom action (like Role.assign_permissions)** → `ddd-new-model` skill → "Custom actions" section.
- **Cross-app data** → never import the other app's models; use a driven port + `infrastructure/adapter` (see backend/CLAUDE.md).

### Reference model = your source of truth

Copy `AssetType` (plain CRUD) or `Role` (custom actions) across all layers — paths are in
[backend/CLAUDE.md](backend/CLAUDE.md). Keep signatures byte-for-byte symmetric so future models stay copy-able.

### Gotchas (also saved as project memory)

- All backend tooling: `uv run …` **from `./backend`**.
- Single-file pytest needs `--no-cov` (global `--cov-fail-under=80`); the full suite needs `-n auto`
  (pytest-xdist parallelization — never run the whole suite serially).
- Entity `clean()` raises **DomainError** subclasses, not Django `ValidationError`.
- `migrate`/`initdb`/`cleandb` need Postgres up; `check`/`ruff`/`mypy`/view tests don't.

---

## Frontend

### Golden path — wire a new module / add a non-trivial feature

```
1. Ask the frontend-feature-planner agent to design it — e.g. "have the frontend-feature-planner design
   a Warehouse module" or "plan adding bulk-import UI to assets".
2. You approve the plan (archetype mirrored, list shape, routing, permissions, open questions).
3. Implement bottom-up: domain → application → infrastructure → presentation → routing
   (navigation.ts + PAGE_HEADERS).
4. `npm run precommit`   # getautotypes + lint + format + typecheck — the full local gate
5. `npm run test` for the new domain/services + component tests.
```

There is **no frontend equivalent of `ddd-architecture-reviewer` yet** — review the diff by hand against
[frontend/CLAUDE.md](frontend/CLAUDE.md)'s rules (data-access pattern, error messages, permission gating,
casing, routing) until one exists.

### Commands (npm scripts — not `.claude/` slash commands)

| Command | When | Notes |
| --- | --- | --- |
| `npm run precommit` | before committing | getautotypes + lint + format + typecheck, in that order |
| `npm run typecheck` | quick check, no mutation | `tsc -b`, project-references build |
| `npm run lint` / `npm run format` | fix style | **mutate files**; use `ci_lint`/`ci_prettier` to check without rewriting |
| `npm run test [-- path \| -t "name"]` | after changing code/tests | run the sandbox disabled — vitest `forks` pool times out sandboxed |
| `npm run getautotypes` | after a backend schema change | regenerates `src/shared/types/`; backend must be running |

### Agents (delegate focused work; read-only)

| Agent | Use for | Output |
| --- | --- | --- |
| `frontend-feature-planner` | design before wiring a new module or a non-trivial feature | per-layer plan (domain/application/infrastructure/presentation) + routing + permissions + test matrix + open questions |

Invoke by asking, e.g. "have the frontend-feature-planner design a Warehouse module in `assets`".

### Common one-offs → what to reach for

- **Blocked by a backend issue while testing** (404/405, schema mismatch) → stop, don't touch `backend/`;
  report the exact error + suspected file:line and wait — see the hard boundary in `frontend/CLAUDE.md`.
- **New list page for a resource** → decide wide (`fetchAllPages`) vs server-paginated
  (`use<Resource>Page`) vs both per the "Two query shapes per resource" rule before writing hooks.
- **Any caught error surfaced to the user** → `getApiErrorMessage(error, { action })`, never a hardcoded or
  generic string.
- **New sortable/paginated table** → reuse `SortHeader` + `Pagination`, don't hand-roll either.

### Reference modules = your source of truth

No single reference module covers every shape — pick per the `frontend-feature-planner`'s archetype list:
`customers`/`users` (CRUD table+drawer), `locations` (standalone detail route), `systemTypes`/`systems`
(card-grid catalog), `forms`/`registrationForms` (multi-POST builder), `roles` (permissions matrix), `norms`
(read-only reference), `planning` (multi-route complex feature). Full detail per module is in
[frontend/modules.md](frontend/modules.md).

### Gotchas (also saved as project memory)

- The frontend agent **never touches `backend/`** — no edits, no `uv`/`manage.py`, no Docker/DB changes.
- `src/shared/types/` is generated — never hand-edit; regenerate with `npm run getautotypes`.
- Check port 5173 (`http://localhost:5173`) before `npm run dev` — Vite silently picks 5174/5175/… instead
  of erroring, so a duplicate dev server spins up unnoticed.
- Don't proactively browser-test with Claude-in-Chrome — verify with typecheck/lint/test and only drive a
  live browser when explicitly asked that turn.
- UI titles/subtitles are **Sentence case**, not Title Case; identifiers/files/routes are English, UI text
  and backend-persisted string values stay Spanish.
