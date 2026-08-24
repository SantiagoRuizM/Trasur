---
name: ddd-view-tests
description: Write the exhaustive pytest/DRF view test suite for a Proyecto3 backend resource — covering RBAC per action, cross-tenant isolation, lifecycle (activate/deactivate), filtering, and auth edge cases. Use when adding or updating tests for a ViewSet, testing API endpoints, or asked to "write tests for X view/model/endpoint".
---

# Write the DRF view test suite

Tests live in `proyecto3/apps/<app>/tests/presentation/views/test_<model>.py`. The gold-standard reference is
[test_company_membership.py](../../../backend/proyecto3/apps/companies/tests/presentation/views/test_company_membership.py)
(also `test_role.py`). Mirror its structure.

## Hard rules

- **Factories only** — never `Model.objects.create()` in a test. Tenant entities link to a `CompanyFactory`.
- **`@pytest.mark.django_db`** on every test class.
- Use `reverse("<models>-list" | "<models>-detail" | "<models>-activate" | "<models>-deactivate", kwargs=...)`
  — never hand-write URLs.
- Authenticate with `api_client.force_authenticate(user=...)`.
- **Single-file runs MUST use `--no-cov`** (global `--cov-fail-under=80` fails an isolated file otherwise):
  `uv run pytest proyecto3/apps/<app>/tests/presentation/views/test_<model>.py -v --no-cov`
- **Full-suite runs MUST use `-n auto`** (`pytest-xdist`, one test DB per worker): `uv run pytest -n auto`.
  Because the suite runs in parallel, every test must be **order-independent** — no reliance on another test
  having run first, no module-level mutable state shared between tests, no hard-coded assumptions about
  auto-increment ids or `factory.Sequence` values. Assert on the objects a test created itself.

## Shared fixtures (already provided)

- Root [proyecto3/conftest.py](../../../backend/proyecto3/conftest.py): `api_client`, `super_admin`.
- App `tests/conftest.py`: domain batches (e.g. `companies`, `customers`).
- Define per-suite fixtures at the top of the test module for: the tenant company, an **authorized actor**
  (a membership whose role has the needed permissions — assign via the role use case), an **actor with no
  permissions**, an **actor from another company**, the **target** entity, a **deactivated** instance, and
  actors with a deactivated role / deactivated user. Copy these from `test_company_membership.py` and rename.

## Required test classes & coverage matrix

One class per action group. Every row below is mandatory.

| Class | Must cover |
| ----- | ---------- |
| `Test<Model>ViewSetList` | 200 with permission; filter by each filterable field; **tenant isolation** (actor of company A gets 403/empty on company B's list); 403 no-permission; 401 unauthenticated; limit & offset pagination; actor with deactivated role/user rejected |
| `Test<Model>ViewSetCreate` | 201 success (assert returned body); 400 invariant violations (e.g. cross-company FK, deactivated FK); 403 without `ADD` perm; 401 unauthenticated; actor deactivated-role rejected |
| `Test<Model>ViewSetRetrieve` | 200 success; cross-company URL → 404/403; other-company actor → 403; 401 unauthenticated; 404 nonexistent; 403 without `VIEW` perm |
| `Test<Model>ViewSetUpdate` | 200 partial & full; 400 invariant violations; not-in-company → 404/403; 403 without `CHANGE`; 401; 404 nonexistent; deactivated instance read-only; actor deactivated-role rejected |
| `Test<Model>ViewSetDestructiveActions` | deactivate 204; activate 200 (assert `is_active`); hard delete 204; already-active/already-inactive idempotency; cross-tenant isolation; 403 per action without the matching perm; 401; 404 nonexistent |

## Conventions that keep assertions stable

- Status codes via `rest_framework.status` constants, not literals.
- Permission-denied is `403`; unauthenticated is `401`; missing/scoped-out resource is `404`. The global
  exception handler maps domain errors, so a business-rule failure (e.g. cross-company role) is typically `400`
  / `409`, not `500` — if you see `500`, the entity/service is leaking a raw error; fix the source, not the test
  (see skill `ddd-domain-errors`).
- For "wrong HTTP verb" cases, remember `deactivate`/`activate` are `PATCH` actions; hard delete is `DELETE` and
  requires `delete` in the view's `http_method_names`.

## After writing

Run the file with `--no-cov`, fix failures at the source (don't weaken assertions to pass), then run
`/backend-check`.
