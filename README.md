# Proyecto3

Django 6 + DRF backend (DDD + Hexagonal) and a React 19 + Vite frontend, scaffolded from the Gestiion
`Logistics` monorepo: same stack, same folder layout, same `.claude/` harness, same rules — with the Django
project package named `proyecto3`.

**Start with [CLAUDE.md](CLAUDE.md)** — it is the cross-cutting operating manual and points at the per-app
ones ([backend/CLAUDE.md](backend/CLAUDE.md), [frontend/CLAUDE.md](frontend/CLAUDE.md)).

## Status

The **structure, tooling and documentation are in place; the product code is not.** Every folder under
`backend/proyecto3/apps/` and `frontend/src/modules/` exists and is empty. The reference implementation of
every pattern the docs describe is the sibling repo `../Logistics`; the build order is in
[CLAUDE.md](CLAUDE.md#first-things-to-build-the-scaffold-assumes-them).

## First run

```bash
cp sample.env .env            # then fill SECRET_KEY and the Postgres/Redis passwords
docker compose up             # backend :8000, Postgres :5432, Redis :6379, celery worker + beat

cd backend  && uv sync        # local backend toolchain (Python 3.14)
cd frontend && npm ci         # local frontend toolchain (Node 25 — see .nvmrc)
```

Both lockfiles (`backend/uv.lock`, `frontend/package-lock.json`) are pinned to the exact versions
`Logistics` runs, so the toolchain is reproducible from the first commit. `docker compose up` will not serve
anything until `backend/proyecto3/settings.py` and `manage.py` exist.

## Repo layout

```
Proyecto3/
├── .claude/           harness — 3 agents, 4 slash commands, 4 skills, permissions
├── .github/workflows/ CI: secret scan, backend gate (ruff/mypy/pytest), frontend gate, schema sync
├── backend/           Django DDD/Hexagonal monolith — proyecto3/apps/<bounded context>/
├── frontend/          React 19 + TanStack Router/Query + Tailwind v4 + Shadcn
├── db/                Postgres image, init script, ER diagram
├── ddd/               strategic + tactical design docs (Mermaid)
├── docker-compose.yaml
├── agent_use_guide.md how the .claude/ pieces chain together
└── CLAUDE.md          the operating manual — read this first
```

## Housekeeping

- Add new secrets to the detect-secrets baseline with `detect-secrets scan --baseline .secrets.baseline`
  from this folder, then audit with `detect-secrets audit .secrets.baseline`.
- Add Shadcn components with `cd frontend && npx shadcn@latest add <component>`.
- `pre-commit install` once, then `pre-commit run --all-files` is the full local gate for both apps.
