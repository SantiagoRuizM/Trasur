# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Bootstrap status.** Proyecto3 is a **fresh repo scaffolded from the Gestiion `Logistics` monorepo**: same
> stack, same folder layout, same `.claude/` harness, same rules — but **no product code yet**. Every folder
> under `backend/proyecto3/apps/` and `frontend/src/modules/` exists but is empty. Until Proyecto3 grows its
> own canonical reference model, the live implementation of every pattern the skills describe is the sibling
> repo **`../Logistics`** — read it there and copy the shape into here. See
> [Where the reference implementation lives](#where-the-reference-implementation-lives) below.

## Repo layout

Two independent apps under one git root:

| Path        | Stack                                            | Notes                                                               |
| ----------- | ------------------------------------------------ | ------------------------------------------------------------------- |
| `backend/`  | Django 6 + DRF, Python 3.14                      | Modular monolith on **DDD + Hexagonal Architecture**. `uv`-managed.  |
| `frontend/` | React 19, TypeScript, Vite, Tailwind v4, Shadcn  | Consumes the backend API; `src/shared/types/` is code-generated.     |

Also at the root: `db/` (the Postgres Docker image + init script, plus `db_modeling.md` ER diagram),
`ddd/` (Mermaid design docs for the bounded contexts' aggregates and DB model), and
`agent_use_guide.md` (how to chain the `.claude/` skills/commands/agents — includes the golden path
for adding a new backend model).

### Where the docs live

**This file is the cross-cutting layer only.** Open the app manual for the code you're actually touching —
each is self-contained, so there's no need to read the other app's docs:

| Doc | Read it when |
| --- | ------------ |
| **this file** | orienting, running the stack, anything spanning both apps |
| [backend/CLAUDE.md](backend/CLAUDE.md) | **before writing any backend code** — layers, golden rules, reference model, seed data |
| [frontend/CLAUDE.md](frontend/CLAUDE.md) | **before writing any frontend code** — architecture, data-access, shared layer, routing, auth |
| [frontend/modules.md](frontend/modules.md) | working inside a specific frontend module — its wiring status and quirks |

---

## Where the reference implementation lives

The `.claude/` skills and agents are copied verbatim from `Logistics` (only the Django package name changed,
`logistics` to `proyecto3`). They cite reference files by path — e.g. `AssetType` across all layers, the
`customers` frontend module. **Those files do not exist in Proyecto3 yet.** Resolve every such citation
against the sibling repo:

```
C:\Users\user\Documents\CodeHubs\Gestiion\Logistics\backend\logistics\apps\...   # backend reference
C:\Users\user\Documents\CodeHubs\Gestiion\Logistics\frontend\src\modules\...     # frontend reference
```

Mapping when you copy: `logistics.apps.<app>` becomes `proyecto3.apps.<app>`; everything else is byte-identical.

**Once Proyecto3 has its own first full-CRUD model**, promote it to the canonical reference: update the
reference table in [backend/CLAUDE.md](backend/CLAUDE.md), the archetype list in
[frontend/modules.md](frontend/modules.md), and delete this section.

### First things to build (the scaffold assumes them)

The tree already reserves the folders; the code is yours to write, in this order:

1. `backend/proyecto3/settings.py`, `urls.py`, `celery.py`, `asgi.py`, `wsgi.py`, `manage.py`, `conftest.py`.
2. `apps/core` — `CoreModel`/`TenantModel`, `CoreDTO`, `BasePermissions`, `DomainError` + the global DRF
   exception handler, `CoreViewSet`/`TenantScopedCoreViewSet`, `CorePermission`/`TenantScopedPermission`.
   **Nothing else can be written before this exists** — every other layer inherits from it.
3. `apps/users` — the IAM reference (user entity, JWT login/refresh).
4. `apps/companies` — the tenant root plus the first everyday-CRUD model, which becomes the reference.
5. `apps/system` — `initdb`/`cleandb` and the seed generators (skill `ddd-seeding`).
6. `frontend/src/modules/auth` (store + Axios refresh interceptor) and `modules/dashboard` (app shell,
   `navigation.ts`, `PAGE_HEADERS`), then the first data module.

---

## Running the stack locally

`docker compose up` (repo root) builds and runs **five** services from
[docker-compose.yaml](docker-compose.yaml) — the backend (`proyecto3`), Postgres (`proyecto3_db_service`),
Redis (`redis`), a Celery worker (`workers`), and the Celery beat scheduler (`beat`); the API is served at
`http://localhost:8000` (base path `/api/v1/`; debugpy listens on 5678). The backend container runs
`makemigrations && migrate && runserver` on boot and waits for healthy DB + Redis. Copy `sample.env` to
`.env` first.

`beat` runs `django_celery_beat`'s `DatabaseScheduler` and fires `CELERY_BEAT_SCHEDULE` (settings.py).
**Run exactly one beat replica**: a second one double-fires every scheduled task.

**Cross-app dependency:** the frontend's `npm run getautotypes` regenerates `src/shared/types/` from
`http://localhost:8000/api/v1/schema/` ([openapi-ts.config.ts](frontend/openapi-ts.config.ts)) — the backend
**must be running** for it to succeed (and for `npm run precommit`, which runs it first). The frontend dev
server itself (`npm run dev`) needs the API up only to make live calls, not to type-check. CI enforces this
sync: the `validate_api_schema` job in [checks.yml](.github/workflows/checks.yml) spins up a freshly migrated
backend, reruns `npx openapi-ts`, and fails the PR if the committed `src/shared/types/types.gen.ts` differs —
so a backend change that touches the API surface needs `getautotypes` run and its diff committed in the same PR.

**Never start a second frontend dev server if one is already up.** Check first (`netstat -ano | grep 517`
on Windows, or just hit `http://localhost:5173` in the browser) before running `npm run dev` — Vite auto-picks
5174/5175/… when 5173 is busy instead of erroring, so a duplicate server silently spins up and just adds
confusion (extra processes, port drift, stale HMR state). Reuse the one already running on 5173.

---

## Backend

**Read [backend/CLAUDE.md](backend/CLAUDE.md) before writing any backend code.** It is the operating manual:
the architecture, the non-negotiable rules, the reference model to copy, and the exact commands.

All backend tooling runs via `uv run` **from `./backend`** (not the repo root).

Backend CI ([checks.yml](.github/workflows/checks.yml)) runs the real gate on every backend-touching PR:
`ruff format --check`, `ruff check`, `mypy`, and the full `pytest -n auto` suite each run as separate jobs —
so pushing without running them locally first just means CI catches it a few minutes later.

### Key commands (from `./backend`)

```bash
uv run pytest proyecto3/apps/<app>/tests/.../test_<model>.py -v --no-cov  # single target
uv run pytest -n auto                # full suite with coverage gate (always parallelize)
uv run ruff format .                 # format
uv run ruff check --fix .            # lint + autofix
uv run mypy proyecto3                # strict type check
uv run python manage.py check        # no DB needed
uv run python manage.py makemigrations && uv run python manage.py migrate
uv run python manage.py initdb       # seed dev data
uv run python manage.py cleandb      # topological teardown
```

---

## Frontend

**Read [frontend/CLAUDE.md](frontend/CLAUDE.md) before writing any frontend code** — architecture (DDD
layering per module), the data-access pattern, the shared layer, routing, and auth. Per-module detail is in
[frontend/modules.md](frontend/modules.md).

All frontend tooling runs from `./frontend`.

### Key commands (from `./frontend`)

```bash
npm run dev          # start Vite dev server
npm run build        # tsc -b && vite build
npm run typecheck    # tsc -b (project-references build; type-check only)
npm run lint         # eslint --fix
npm run format       # prettier --write
npm run test         # vitest run (single pass)
npm run test -- src/modules/<module>/domain/services/index.test.ts   # single file
npm run test -- -t "maps the dto"                                    # single test by name
npm run test:e2e     # Playwright — live per-entity CRUD suite (dev server + backend must be up)
npm run getautotypes # regenerate src/shared/types/ from backend OpenAPI schema (backend must be running)
npm run precommit    # getautotypes + lint + format + typecheck (full local gate)
```

**Run `npm run test:e2e` before every push.** CI ([.github/workflows/checks.yml](.github/workflows/checks.yml))
runs only prettier/lint/typecheck/build for the frontend — **neither Vitest nor Playwright runs there**, so
those two only ever run if you run them. The e2e suite drives the real app against the running backend and
seeded database; see [frontend/e2e/README.md](frontend/e2e/README.md) for what it covers, what it
deliberately doesn't, and the per-user `1000/hour` backend throttle that makes back-to-back runs fail.

`lint` and `format` **mutate** files; the `ci_*` variants (`ci_lint`, `ci_prettier`, `ci_typecheck`,
`ci_build`) are check-only.

### Rules that apply even for a one-line change

These are the ones that get violated in passing; the full rationale for each is in
[frontend/CLAUDE.md](frontend/CLAUDE.md).

- **The frontend agent never touches `backend/`** — no file edits, no `uv`/`manage.py` commands, no Docker
  restarts, no DB/migration changes. A blocking backend issue gets **reported, not fixed in place**.
- **`src/shared/types/` is generated** from the backend's OpenAPI schema — never hand-edit it; regenerate
  with `npm run getautotypes`.
- **Never write a generic UI error string** (`"Ocurrió un error inesperado…"` and friends are *banned*).
  Every caught error goes through `getApiErrorMessage(error, { action })` from `src/shared/lib/apiError.ts`.
- **UI titles are Sentence case**, not Title Case — "Órdenes de trabajo", not "Órdenes de Trabajo".
- **Identifiers/files/routes are English; UI text and backend-persisted string values stay Spanish.**
  Renaming a persisted value is a data migration, not a rename.
- **Don't proactively browser-test.** Verify with `npm run typecheck`, `npm run lint`, `npm run test` and
  report what they covered; drive a live browser only when the user asks for it in that turn.

---

## Conventions (both apps)

- `pre-commit` is configured at the repo root (`.pre-commit-config.yaml`) and covers backend (ruff, mypy,
  detect-secrets) and frontend.
- Branch off `main`; commit backend migrations alongside the model change.
- Conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`) — the workspace-wide rule from
  [../CLAUDE.md](../CLAUDE.md).
- To add new secrets to the detect-secrets baseline: `detect-secrets scan --baseline .secrets.baseline` from
  the repo root, then audit with `detect-secrets audit .secrets.baseline`.

## Tooling shortcuts (`.claude/`)

- **Commands**: `/backend-check`, `/backend-test`, `/backend-migrate`, `/new-model`
- **Skills**: `ddd-new-model`, `ddd-view-tests`, `ddd-domain-errors`, `ddd-seeding`
- **Agents**: `ddd-feature-planner` (designs cross-layer backend plan), `ddd-architecture-reviewer` (audits a
  backend diff), `frontend-feature-planner` (designs cross-layer frontend plan)

See [agent_use_guide.md](agent_use_guide.md) for how these chain together (e.g.
`/new-model <Model> <app> [tenant|global]` runs plan → implement → tests → check → migrate → audit).
