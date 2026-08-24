---
description: Run the backend local quality gate (ruff format check, ruff lint, mypy strict, django check)
argument-hint: "[path] (optional, defaults to proyecto3)"
allowed-tools: Bash(cd:*), Bash(uv run ruff:*), Bash(uv run mypy:*), Bash(uv run python manage.py check:*)
---

Run the full backend quality gate from the `backend/` directory. Target path: `${ARGUMENTS:-proyecto3}`.

Run these four steps and report results grouped by tool. Do NOT auto-fix unless I ask — first show me what fails.

```bash
cd backend
uv run ruff format --check ${ARGUMENTS:-.}
uv run ruff check ${ARGUMENTS:-.}
uv run mypy ${ARGUMENTS:-proyecto3}
uv run python manage.py check
```

For each tool: report pass/fail and the specific findings. If everything passes, say so concisely. If there are
failures, summarize them by file and offer to fix (ruff issues are usually `uv run ruff check --fix` +
`uv run ruff format`; mypy and django-check failures need manual edits). `manage.py check` needs no database.
