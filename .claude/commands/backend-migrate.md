---
description: Create and apply Django migrations for the backend, then verify
argument-hint: "[app label] (optional, e.g. companies)"
allowed-tools: Bash(cd:*), Bash(uv run python manage.py makemigrations:*), Bash(uv run python manage.py migrate:*), Bash(uv run python manage.py showmigrations:*), Bash(uv run python manage.py check:*)
---

Generate and apply migrations from the `backend/` directory.

**Requires the Postgres DB to be up** (`docker compose up -d` at the repo root). If `migrate` fails with a
connection error, tell me to start the DB rather than retrying blindly.

Steps:
1. `cd backend && uv run python manage.py makemigrations ${ARGUMENTS}` — then **show me the generated migration
   file(s)** and summarize the schema changes before applying.
2. `cd backend && uv run python manage.py migrate ${ARGUMENTS}`
3. `cd backend && uv run python manage.py check`

Afterward, remind me to **commit the migration file(s)** together with the model change in the same commit.
If `makemigrations` reports "No changes detected", stop and say so — don't run `migrate`.
