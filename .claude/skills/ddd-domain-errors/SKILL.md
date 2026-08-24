---
name: ddd-domain-errors
description: Define and raise domain errors correctly in the Proyecto3 backend so they map to the right HTTP status via the global DRF handler. Use when adding a new business-rule error, fixing a 500 that should be a 400/404/409, enforcing an entity invariant in clean(), or stopping a service/adapter from leaking IntegrityError/ValidationError.
---

# Domain errors & the global exception handler

The backend handles errors with **custom domain exceptions + one global handler**. Views never use
`try/except`. The full rationale is in [exceptions.md](../../../backend/exceptions.md).

## The mechanism

- Base class: `DomainError` in
  [core/domain/exceptions.py](../../../backend/proyecto3/apps/core/domain/exceptions.py) — carries `code`,
  `message`, `status_code`, `category` (`ErrorCategory`), and accepts `message=`, `details=`, `metadata=`,
  `origin=`, `action=`.
- Global handler:
  [core/presentation/api/exception_handler.py](../../../backend/proyecto3/apps/core/presentation/api/exception_handler.py)
  renders any `DomainError` as its `status_code` with a structured body; anything else falls through to `500`.
- **Key subtlety:** `CoreModel.save()` calls `full_clean()`. `full_clean()` only catches Django's
  `ValidationError`. A `DomainError` raised in `clean()` is **not** a Django `ValidationError`, so it propagates
  straight through `full_clean()` → `save()` → the view → the global handler → correct HTTP. This is why entity
  invariants raise `DomainError` subclasses, not `django.core.exceptions.ValidationError`.

## Defining a new error (per bounded context)

In the app's `domain/exceptions.py`:

```python
from rest_framework import status
from proyecto3.apps.core.domain.exceptions import DomainError, ErrorCategory

class <App>ErrorCodes(StrEnum):
    ...
    <MODEL>_VALIDATION_ERROR = auto()   # add the code

class <Model>ValidationError(DomainError):
    code = <App>ErrorCodes.<MODEL>_VALIDATION_ERROR
    message = "<Model> validation error"
    status_code = status.HTTP_400_BAD_REQUEST       # 404 NOT_FOUND / 409 CONFLICT / 400 BUSINESS_RULE
    category = ErrorCategory.BUSINESS_RULE           # PERMISSION | NOT_FOUND | TECHNICAL | BUSINESS_RULE
```

Status/category conventions used across the codebase:
- `*DoesNotExistError` → `404` + `ErrorCategory.NOT_FOUND`
- `*AlreadyExistsError` → `409` + `ErrorCategory.BUSINESS_RULE`
- invariant/validation → `400` + `ErrorCategory.BUSINESS_RULE`

## Raising — by layer

- **Entity `clean()`** — raise the `DomainError` subclass directly, passing `origin="<Model>.clean"` (and
  `message=str(_( ... ))` for a specific human message). Example: `CompanyMembership.clean()` in
  [company_membership.py](../../../backend/proyecto3/apps/companies/domain/entities/company_membership.py)
  raises `CompanyMembershipValidationError` for cross-company / inactive role.
- **Service** — map persistence failures: `except IntegrityError → raise <Model>AlreadyExistsError`; on lookup
  miss `except <Model>.DoesNotExist → raise <Model>DoesNotExistError(origin=..., details={...})`. Separate the
  branches — do **not** catch `ValidationError` and `IntegrityError` together if they mean different things
  (a `400` validation vs a `409` conflict).
- **Adapter (infrastructure)** — never leak external exceptions; catch and re-raise a mapped `DomainError`
  (often `ErrorCategory.TECHNICAL`).
- **View** — nothing. Let it bubble. Declare expected errors in `@custom_extend_schema(exceptions=[...])` so the
  OpenAPI docs list them.

## Diagnosing a 500

A `500` in a test or response almost always means a raw `IntegrityError`/Django `ValidationError`/`DoesNotExist`
escaped a service, adapter, or entity. Fix it at the source by mapping to a `DomainError` — never by adding
`try/except` in the view or weakening a test.
