---
description: Run backend pytest for a path/node-id (parallel full suite; auto-adds --no-cov for single targets)
argument-hint: "[test path or node id] (optional; empty = full suite)"
allowed-tools: Bash(cd:*), Bash(uv run pytest:*)
---

Run the backend test suite from the `backend/` directory.

Target: `$ARGUMENTS`

Rules:
- **No argument** → run the full suite in parallel with the coverage gate. `pytest-xdist` gives each worker
  its own test database, and coverage still aggregates across workers, so **always** pass `-n auto` here —
  never run the full suite serially:
  ```bash
  cd backend && uv run pytest -n auto
  ```
- **A specific file, directory, or `::` node id** → add `--no-cov` (the global `--cov-fail-under=80` makes an
  isolated run "fail" on coverage even when tests pass). Keep these serial — xdist's worker startup costs more
  than it saves on a single target:
  ```bash
  cd backend && uv run pytest $ARGUMENTS -v --no-cov
  ```

After running: if tests fail, show the failing test names + the assertion/traceback, and diagnose the **source**
(a `500` usually means a service/entity is leaking a raw error — see the `ddd-domain-errors` skill). Do not
weaken assertions to make tests pass.
