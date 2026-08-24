# Backend — Operating Manual (DDD + Hexagonal)

Django 6 + DRF modular monolith. Each Django app under `proyecto3/apps/<context>/` is a **bounded context**
with four strictly separated layers. This file is the quick operating manual; the full rationale is in
[README.md](README.md) (blueprint), [development.md](development.md) (step-by-step + seeding), and
[exceptions.md](exceptions.md) (errors).

> **Bootstrap status.** The folder tree exists; the code does not. There is no reference model in this repo
> yet — until there is, the canonical implementation of every pattern below is
> `../../Logistics/backend/logistics/apps/`, with `logistics.apps.<app>` renamed to `proyecto3.apps.<app>`
> on the way in. See [Canonical reference model](#canonical-reference-model) and the root
> [CLAUDE.md](../CLAUDE.md).

## Bounded contexts (`proyecto3/apps/`)

The scaffold ships these five plus the cross-cutting E2E suite. Add a new context by creating the same
four-layer folder shape — nothing about a context is special beyond that shape.

| App            | What lives here |
| -------------- | --------------- |
| `core`         | Shared base, no API of its own — `CoreModel`/`TenantModel` (`core.py`), the tenant root, attachments, custom fields, and the global DRF exception handler. **Build this first; everything inherits from it.** |
| `users`        | IAM — the `user` entity and auth/login. **Reference for IAM.** |
| `companies`    | The main CRUD context — the tenant plus its everyday models. **Reference for everyday CRUD**: the first full-CRUD model you write here becomes the shape every later model copies. |
| `system`       | No entities — hosts the `initdb`/`cleandb` management commands and the seed generators. |
| `user_stories` | No entities — a scenario **DSL/test engine** (data builders, operations, conditions, a step engine). Consumed by the cross-cutting E2E suite in `proyecto3/apps/tests/`; **not product code**. |
| `tests`        | Cross-cutting end-to-end API story tests built on the `user_stories` DSL. |

## The four layers (per bounded context)

```
domain/          # business knowledge, zero side effects
  entities/      # Django models (CoreModel / TenantModel), invariants in clean()
  dtos/          # pydantic contracts (CoreDTO); never leak HTTP into the app
  value_objects/ # permissions enums (BasePermissions)
  exceptions.py  # DomainError subclasses + an error-code StrEnum
  ports/drivers/ # INBOUND interfaces: what this app CAN DO (I<...>UseCase, I<...>ManagementDriverPort)
  ports/driven/  # OUTBOUND interfaces: what this app NEEDS from outside
application/
  services/      # reusable business logic + ORM access for this context (the real work)
  use_cases/     # thin orchestrators implementing driver ports; transaction boundaries
infrastructure/
  adapters/      # implementations of driven ports (cross-context, external systems)
presentation/
  api/serializers/  # validate raw input -> build a DTO (.create returns the DTO)
  api/views/        # razor-thin DRF ViewSets; NO try/except
  api/filters/      # django-filter FilterSets
  providers/        # DI: get_<x>_usecase() factories (@lru_cache for stateless ones)
models.py        # re-exports entities so Django discovers them
urls.py          # nested DRF routers
```

## Golden rules (do not violate)

- **No cross-app model imports.** A context reaches another only through a **driven port** + an
  `infrastructure/adapter` that calls the other app's use case and returns a DTO. Never import or query
  another app's models/tables directly.
- **Views are thin and have no `try/except`.** Domain errors bubble to the global handler at
  `proyecto3/apps/core/presentation/api/exception_handler.py`, which renders any `DomainError` as its
  `status_code`. Validate input in the serializer, call the use case via a provider, return `Response`.
- **Invariants live in the entity's `clean()`.** Raise a **`DomainError` subclass** (not Django
  `ValidationError`). `CoreModel.save()` calls `full_clean()` automatically, and because a `DomainError` is not
  a Django `ValidationError` it propagates straight through `full_clean()` to the global handler → correct HTTP.
  → skill `ddd-domain-errors`.
- **Never leak infrastructure errors.** Services/adapters catch `IntegrityError`/Django `ValidationError`/etc.
  and raise a mapped `DomainError`.
- **Never call a Use Case from another Use Case.** Shared logic goes in a Service. Use cases are entry points /
  transaction boundaries (`@transaction.atomic` when multi-step).
- **Tenant scoping.** Company-owned entities inherit `TenantModel` and use `TenantManager`/`TenantQuerySet`.
  Tenant views mount on nested routes (`/companies/<company_pk>/<resource>/`), add `TenantScopedPermission()` +
  `CorePermission(...)` in `get_permissions()`, and filter `get_queryset()` by `self.company_uuid`.
- **Tests use factories only** (`factory_boy`), never `Model.objects.create()`. Cover RBAC, cross-tenant
  isolation, lifecycle, and filtering. → skill `ddd-view-tests`.
- **Symmetry.** Every CRUD model mirrors the same shape across all layers. Copy the reference model; do not
  invent a new structure.

## Canonical reference model

**Proyecto3 has none yet.** Read the reference across all layers in the sibling repo and copy it in — the
per-layer templates in [.claude/skills/ddd-new-model/reference.md](../.claude/skills/ddd-new-model/reference.md)
are already transcribed from it and are the fastest path.

| Layer            | Reference file (in `../../Logistics/backend/`) |
| ---------------- | ---------------------------------------------- |
| entity           | `logistics/apps/companies/domain/entities/asset_type.py` |
| permissions      | `logistics/apps/companies/domain/value_objects/permissions.py` |
| dtos             | `logistics/apps/companies/domain/dtos/asset_type.py` |
| driver ports     | `logistics/apps/companies/domain/ports/drivers/asset_type.py` |
| service iface    | `logistics/apps/companies/domain/services/asset_type.py` |
| service impl     | `logistics/apps/companies/application/services/asset_type.py` |
| use cases        | `logistics/apps/companies/application/use_cases/asset_type.py` |
| providers        | `logistics/apps/companies/presentation/providers/asset_type.py` |
| serializers      | `logistics/apps/companies/presentation/api/serializers/asset_type.py` |
| view             | `logistics/apps/companies/presentation/api/views/asset_type.py` |
| urls             | `logistics/apps/companies/urls.py` |
| tests            | `logistics/apps/companies/tests/presentation/views/test_company_membership.py` |

Use `AssetType` for plain CRUD and `Role` for custom actions/permissions (e.g. `assign_permissions`).

**When Proyecto3's first full-CRUD model lands, replace this whole table with local paths** and drop the
bootstrap note at the top — from then on the local model is the source of truth.

Naming conventions to keep symmetric: service has `<verb>_<model>` and `<verb>_<model>_by_uuid` pairs;
`get_or_create_<model>`; `filter_<models>` + `filter_<models>_from_queryset`; lifecycle methods take
`executed_by_uuid`; update DTO carries `<model>_uuid`; providers are `@lru_cache` except the
`executed_by_uuid`-parameterized lifecycle ones; a `<Model>ManagementDriverPort` aggregates all use cases
(single-use-case driver ports skip the aggregate — say so in the port's module docstring).

## Commands (run from `./backend`)

```bash
# Tests — single file/target MUST use --no-cov (global --cov-fail-under=80 fails otherwise)
uv run pytest proyecto3/apps/<app>/tests/presentation/views/test_<model>.py -v --no-cov
uv run pytest -n auto                           # full suite with coverage gate — ALWAYS parallelize

# Lint / format / types
uv run ruff format .                            # format
uv run ruff check --fix .                       # lint + autofix
uv run mypy proyecto3                           # strict type check

# Django
uv run python manage.py check                   # no DB needed
uv run python manage.py makemigrations
uv run python manage.py migrate                 # needs Postgres up (docker compose)
uv run python manage.py initdb                  # seed data (generators)
uv run python manage.py cleandb                 # topological teardown

# Full local gate at repo root
pre-commit run --all-files
```

The DB runs via `docker compose`; `migrate`/`showmigrations`/`initdb`/`cleandb` need it up. `check`, `ruff`,
`mypy`, and most unit/view tests (sqlite in-memory) do not.

**Always run the full suite in parallel: `uv run pytest -n auto`.** `pytest-xdist` is installed and each
worker gets its own test database, so a serial full run is just wasted minutes — never run bare `uv run pytest`
over the whole suite. `-n auto` is **not** for single-file runs: the worker-startup overhead dominates, so keep
targeted runs serial (`-v --no-cov`). Coverage still aggregates correctly across workers, so the
`--cov-fail-under=80` gate holds under `-n auto`. Tests must therefore stay order-independent and free of
shared mutable state — anything relying on execution order will flake under xdist.

**Two test layers.** Per-app **view suites** under `proyecto3/apps/<app>/tests/presentation/views/test_<model>.py`
(factory_boy; RBAC + cross-tenant + lifecycle + filtering — skill `ddd-view-tests`), and cross-cutting
**end-to-end API story tests** in `proyecto3/apps/tests/` built on the `user_stories` DSL.

## Background work (Celery)

Tasks live in each app's `tasks.py` and are thin: they resolve a use case from a provider and call it, so
the business logic stays testable without a broker. Under tests `CELERY_TASK_ALWAYS_EAGER` is on, so
`.delay()` runs inline and propagates.

Two flavors, and the distinction matters for where the trigger lives:

- **Event-driven** — fired by a use case after a user action (email sends, imports, document renders).
- **Scheduled** — declared in `CELERY_BEAT_SCHEDULE` in `proyecto3/settings.py` and fired by the `beat`
  service in the root `docker-compose.yaml` (`django_celery_beat`'s `DatabaseScheduler`; **run exactly one
  replica** or every scheduled task double-fires).

Two properties every scheduled task needs, learned the hard way in `Logistics`: make it **idempotent** and
fire it on a **window check** rather than one exact date, so a day the worker was down is recovered by the
next run; and **contain failures to the smallest sensible unit** so one tenant's bad data can't cost every
other tenant its run.

## Seed data (`initdb`)

`uv run python manage.py initdb --all` runs every registered generator in topological dependency order;
`cleandb` tears down leaf→root by inspecting `model._meta.get_fields()`, so a new model with standard
`ForeignKey`s needs no teardown wiring. Adding a generator is the skill `ddd-seeding`.

Build a **showcase generator** early: one fully-populated tenant with a credentialed login per permission
profile (admin / supervisor / operator / read-only), so every frontend module and the roles matrix have
realistic data for manual QA. Make it **no-op if its tenant already exists**, and have the generic generators
exclude it by name so they never churn the showcase dataset.

Permissions are baked into the **JWT at login**, so a user affected by a role change must **log out and back
in** (not just refresh) to see it.

## New-feature workflow

1. Plan the cross-layer shape (`/new-model <Model> <app>` or the `ddd-feature-planner` agent).
2. Implement bottom-up following skill **`ddd-new-model`**: entity → permissions → dtos → ports → service iface
   + impl → use cases (+ management driver port) → providers → serializers → view → register in `urls.py`.
3. Write the exhaustive view suite (skill **`ddd-view-tests`**) and run it with `--no-cov`.
4. `/backend-check` (ruff + mypy + django check), then `/backend-migrate` if the model changed schema.
5. Optional: register an `initdb` generator (skill **`ddd-seeding`**).
6. Audit with the `ddd-architecture-reviewer` agent before committing.
