---
name: ddd-new-model
description: Implement a new model/resource (full CRUD + activate/deactivate) across all DDD layers in the Proyecto3 backend, mirroring the AssetType/Role reference. Use when adding a new entity, model, resource, or endpoint to a Django bounded context (proyecto3/apps/<app>) — e.g. "add a Warehouse model", "create a new resource in companies", "scaffold CRUD for X".
---

# Add a new model across all DDD layers

This backend is a DDD + Hexagonal modular monolith with strict cross-model symmetry. To add a model you
**copy the canonical reference (`AssetType`) into a new name**, one file per layer. Do not invent structure.

Read [backend/CLAUDE.md](../../../backend/CLAUDE.md) first for the golden rules. The exact, copy-pasteable
per-layer templates are in **[reference.md](reference.md)** — open it and substitute the names.

## Naming substitutions

Given a model `Warehouse` in app `companies`:

| Placeholder      | Example                          |
| ---------------- | -------------------------------- |
| `<Model>`        | `Warehouse`                      |
| `<model>`        | `warehouse`                      |
| `<models>`       | `warehouses` (plural)            |
| `<app>`          | `companies`                      |
| `<model_no_under>` | `warehouse` (Django perm codename, no underscores) |

Tenant-owned (belongs to a company) → inherit `TenantModel` (the common case). Global → inherit `CoreModel`
and use `CoreManager`/`CoreQuerySet`.

## Procedure (bottom-up; each step = one file)

1. **Entity** `domain/entities/<model>.py` — `TenantModel` subclass + `<Model>QuerySet`/`<Model>Manager`,
   `search_fields`, fields, `Meta` (`unique_together`, `ordering`, `permissions = <Model>Permissions.get_permissions_tuple_list()`).
   Put business invariants in `clean()` raising a `DomainError` subclass (see skill `ddd-domain-errors`).
2. **Register the entity** in `<app>/models.py` (`from ...domain.entities.<model> import <Model>`) so Django discovers it.
3. **Permissions** `domain/value_objects/permissions.py` — add `class <Model>Permissions(BasePermissions)` with
   ADD/CHANGE/DELETE/VIEW + ACTIVATE/DEACTIVATE (and custom actions if any).
4. **DTOs** `domain/dtos/<model>.py` — `Create<Model>Request`, `Update<Model>Request` (carries `<model>_uuid`),
   `<Model>ViewContext(TenantScopedAuthContext)` with `target_<model>_uuid`.
5. **Exceptions** `domain/exceptions.py` — add `<MODEL>_NOT_FOUND` / `<MODEL>_ALREADY_EXISTS` codes and
   `<Model>DoesNotExistError` (404) / `<Model>AlreadyExistsError` (409). Add a `<Model>ValidationError` (400)
   if `clean()` enforces invariants.
6. **Driver ports** `domain/ports/drivers/<model>.py` — one `I<Verb><Model>UseCase` per operation + the
   `I<Model>ManagementDriverPort` aggregate.
7. **Service interface** `domain/services/<model>.py` — `I<Model>Service(ABC)` with the full method set
   (create, get_or_create, update(+_by_uuid), retrieve(+_from_queryset), filter(+_from_queryset),
   activate/deactivate(+_by_uuid), delete(+_by_uuid)).
8. **Service impl** `application/services/<model>.py` — `<Model>Service(I<Model>Service)`. This holds the real
   ORM work. `create` catches `IntegrityError` → `<Model>AlreadyExistsError`. Updates use
   `model_dump_with_mapped_ids(exclude_unset=True, exclude={"<model>_uuid"})`. Retrieves raise
   `<Model>DoesNotExistError` with `origin=`/`details=`.
9. **Use cases** `application/use_cases/<model>.py` — thin wrappers delegating to a module-level
   `_<model>_service = <Model>Service()`; lifecycle use cases take `executed_by_uuid` in `__init__`; add
   `<Model>ManagementDriverPort` aggregating them. `@transaction.atomic` on multi-step use cases only.
10. **Providers** `presentation/providers/<model>.py` — `get_<verb>_<model>_usecase()` factories. `@lru_cache`
    on stateless ones; the `executed_by_uuid`-parameterized lifecycle providers are **not** cached.
11. **Serializers** `presentation/api/serializers/<model>.py` — `<Model>Serializer(AbstractCoreModelSerializer)`,
    `Create<Model>RequestSerializer` (HiddenFields `AuthenticatedUserDefault`/`CurrentCompanyDefault`),
    `Update<Model>RequestSerializer` (HiddenField `ContextTarget<Model>` → `<model>_uuid`). `.create()` returns the DTO.
12. **Filters** `presentation/api/filters/<model>.py` (or inline in the view, like AssetType) —
    `<Model>FilterSet(CoreFiltersMixin, FilterSet)`.
13. **View** `presentation/api/views/<model>.py` — `<Model>ViewSet(TenantScopedCoreViewSet[<Model>])`,
    `get_permissions()` wiring `IsAuthenticated`+`TenantScopedPermission`+`CorePermission` per action,
    `get_queryset()` filtered by `self.company_uuid`, CRUD + `@action` activate/deactivate, each decorated with
    `@custom_extend_schema(...)`. No `try/except`.
14. **URLs** register on the nested router in `<app>/urls.py`
    (`_companies_router.register(r"<models>", <Model>ViewSet, basename="<models>")`).
15. **Tests** — exhaustive view suite (use skill `ddd-view-tests`). Run with `--no-cov`.
16. **Migrations & check** — `/backend-migrate` then `/backend-check`.

## Custom actions (like Role.assign_permissions)

If the model needs domain actions beyond CRUD: add the permission enum members, an extra
`I<Action><Model>UseCase` port + use case + provider, a dedicated request serializer, and an
`@action(detail=True, methods=[...])` method with its own `@custom_extend_schema`. Mirror
`proyecto3/apps/companies/.../role.py` across the layers.

## Gotchas

- `delete` is excluded from `CoreViewSet.http_method_names`; if the view defines `destroy`, add
  `http_method_names = [*TenantScopedCoreViewSet.http_method_names, "delete"]`.
- Entities must raise `DomainError` subclasses (not Django `ValidationError`) from `clean()` so the global
  handler maps them to HTTP — see skill `ddd-domain-errors`.
- Keep method signatures byte-for-byte symmetric with the reference so future models stay copy-able.
