# Proyecto3 Platform - Backend Development Methodology

This document specifies the definitive development methodology and architectural blueprint for the backend of the Proyecto3 Management Platform. It serves as an exhaustive, step-by-step guide on how to implement features using **Domain-Driven Design (DDD)**, **Hexagonal Architecture (Ports & Adapters)**, **Active Record with Aggregate Discipline**, **Dependency Inversion Principle (DIP)**, and **Modularity**, as currently implemented in the codebase (e.g., the `users`, `core`, `system`, and `companies` apps).

The source of truth for these paradigms across the application ecosystem is demonstrated entirely within the `users` (Identity & Access) app.

---

## 1. Architectural Philosophy & Strategy

This project eschews standard unstructured Django implementations ("Fat Models, Fat Views"). Instead, it embraces a **Modular Monolith** structure where application complexity is rigorously controlled through decoupling.

### Key Tenets
1. **Bounded Contexts = Django Apps**: Each Django app represents a strictly isolated bounded context (e.g., `companies`, `users`, `system`).
2. **No Direct Import Between Contexts**: Direct cross-app ORM imports or model lookups are strictly prohibited. The system interacts *only* through established contracts.
3. **Hexagonal Boundaries (Ports & Adapters)**: Business application limits are defined by "Ports" (Interfaces). Any interaction bridging an app boundary utilizes "Adapters".
4. **Behavioral Active Record & Aggregate Discipline**: Domain Entities mirror Django Models to harness the ORM capabilities but are enriched with business behaviors enforcing aggregate invariants.
5. **DIP (Dependency Inversion Principle)**: Implementations depend on abstractions. Dependency injection is managed within the Presentation layer to construct application Use Cases automatically.

---

## 2. Anatomy of a Bounded Context

Each domain app inside `backend/proyecto3/apps/<context>/` follows a complete separation between domain knowledge, application flow, and infrastructure concerns.

```text
<context>/
├── __init__.py
├── admin.py                 # Standard Django admin bindings
├── apps.py                  # Standard Django AppConfig
├── urls.py                  # Standard Django routing
├── migrations/
├── models.py                # Re-exports the entities from domain/entities/ for ORM discovery
│
├── domain/                  # LAYER 1: Core Business Knowledge (Zero side effects)
│   ├── dtos/                # Data Transfer Objects (contracts for inter-layer/inter-app data)
│   ├── entities/            # Django Models inheriting from core.CoreModel or TenantModel
│   ├── value_objects/       # Immutable structures and enums (e.g., Permissions)
│   ├── exceptions.py        # Pure domain errors
│   ├── events/              # Domain Event definitions (Dataclasses)
│   └── ports/
│       ├── drivers/         # INBOUND PORTS: What the app CAN DO (I<UseCase>)
│       └── driven/          # OUTBOUND PORTS: What the app NEEDS (I<Adapter>)
│
├── application/             # LAYER 2: Application Flow
│   ├── use_cases/           # Orchestrators implementing Inbound Driver Ports
│   └── services/            # Reusable complex business rules
│
├── infrastructure/          # LAYER 3: Outbound Connectivity
│   └── adapters/            # Implementations of Outbound Driven Ports
│
├── presentation/            # LAYER 4: Inbound external access (HTTP, CLI, UI)
│   ├── api/
│   │   ├── filters/         # Request parameters filtering (django-filters)
│   │   ├── serializers/     # Input validation, mapping onto DTOs
│   │   └── views/           # DRF ViewSets
│   └── providers/           # Dependency Injection wiring
│
├── factories/               # Data seeding factories (factory_boy)
└── tests/                   # Pytest suite
```

---

## 3. Core Structural Layers

### 🔵 3.1 Domain Layer
The epicenter of the logic. It does not possess any framework configurations except for Active Record mappings.

#### Entities (`domain/entities/`)
Django models live here instead of the root directory. They define fields but critically embed **business invariants**, overriding `clean()` entirely over unstructured updates.

*(Note: While putting views or queries in models.py works in classic Django, we restrict our Entities to enforcing state boundaries strictly. The root `models.py` simply contains `from proyecto3.apps.users.domain.entities.user import User`.)*

- **Global Entities:** Inherit from `proyecto3.apps.core.domain.entities.core.CoreModel` (which inherently overrides `save()` to call `full_clean()`).
- **Tenant Entities (Multitenancy):** If an entity belongs to a specific company (which is the majority case), it **must** inherit from `proyecto3.apps.core.domain.entities.tenant.TenantModel`.
- **QuerySets:** Global entities use `CoreQuerySet` and `CoreManager`. Tenant entities must use `TenantQuerySet` and `TenantManager` to allow `.by_company(uuid)` filtering.
- **Invariants:** Override `clean()` to enforce business invariants. Raise `django.core.exceptions.ValidationError` if invariants fail.

#### DTOs (`domain/dtos/`)
Typed classes (Pydantic / Dataclasses) used to serialize inputs and pass them deep into the application safely without leaking HTTP constraints. For tenant-scoped views, contexts (like `RoleViewContext`) must explicitly require `company_uuid` alongside `logged_user_uuid`.

#### Ports (`domain/ports/`)
- **Drivers (`drivers/`)**: Expose the app to the world (e.g., `class ICreateRoleUseCase(ABC):`).
- **Driven (`driven/`)**: Abstract dependencies (e.g., cross-app calls, external HTTP).

### 🟡 3.2 Application Layer
Translates pure domain rules into executed state transitions.

#### Use Cases (`application/use_cases/`)
They implement the Driver Ports exactly. They represent **User Intents** or **System Commands**.
- **Role:** They are pure **Orchestrators**. A Use Case should simply: Fetch DTOs -> Invoke Entities/Services -> Save Entities.
- **Rule #1 (No HTTP):** Use cases never touch `<Request>` objects or Django Responses directly.
- **Rule #2 (Never nest Use Cases):** You should **NEVER** call Use Case A from Use Case B. Use Cases are entry points defining transaction boundaries. Share logic via Services instead.

#### Services (`application/services/`)
Stateless classes containing complex business rules that span multiple Entities or algorithms.
- **Role:** Reusable logic blocks. While an Entity's `clean()` method manages rules for *that specific record*, a Service coordinates rules spanning *multiple* records.
- **Tenant Filtering:** They are responsible for enforcing Tenant filtering before passing lists to the Presentation Layer (e.g., `RoleService().filter_roles_from_queryset(queryset, company__uuid=...)`).

### 🔴 3.3 Presentation Layer
Interprets the outside world using Django Rest Framework.

#### Views (`presentation/api/views/`)
- Inherit from `GenericViewSet` (or custom BaseViewSets).
- Views are extremely thin. **No exception handling (`try/except`) should exist in Views** (exceptions are handled globally).
- **Multitenancy & Nested Routing:** For tenant-scoped views, they are usually mounted on nested URLs (`/companies/<company_pk>/roles/`). The View extracts `self.kwargs.get("company_pk")` and passes it into the Service layer and DTO context.
- **Custom Actions:** Use the `@action` decorator for specific domain behaviors (e.g., `@action(detail=True, methods=["post"]) def assign_permissions(...)`). These must have their own custom request serializers and be decorated with `@custom_extend_schema`.

#### Serializers (`presentation/api/serializers/`)
Validate raw input and convert them to DTOs. Example: `CreateRoleRequestSerializer`.

#### Providers (`presentation/providers/`)
Fulfills DIP. Exposes factory functions to the View (e.g., `get_create_role_usecase()`) so the view doesn't know about internal implementations or adapters.

### 🟢 3.4 Infrastructure Layer
Performs the technical scaffolding.

#### Adapters (`infrastructure/adapters/`)
Implementations of Driven Ports. When your Application needs to speak to AWS, talk to an external Maintenance CRM, or cross a bounded context to lookup an `Asset`, an Adapter lives here.

---

## 4. Shared Kernel (`core/`)

The core application provides standard abstractions and infrastructure inherited throughout the project. It strictly contains zero domain-specific behaviors.

**Responsibilities**:
- `CoreModel` holding IDs, `created_at`, `updated_at`, and soft-delete semantics (`deactivated_at`).
- `CoreManager` and `CoreQuerySet` ensuring domain searches honor multi-tenant partitioning implicitly and omit soft-deleted records.
- Standard utility exceptions, formatters, and authentication utilities.

No domain app should define foundational configurations, and `core/` will NEVER point its dependencies toward a Domain app.

---

## 5. System Dynamics & Communication

### Bounded Context Communication
If the `workforce` app needs to know if a practitioner is an active `User`, mapping directly via ForeignKey `users.models.User` translates to high structural coupling.
Instead:
1. `workforce` exposes a Driven Port: `class IResourceAuth(ABC)`.
2. `workforce` accesses resources *only* by IDs.
3. An `infrastructure/adapter` within `workforce` imports the DTO layer of `users` (`get_retrieve_user_usecase().execute(id)`).

### Domain Events (Synchronous Strategy)
System transactions regularly trigger side effects out of boundaries. We achieve synchronous distributed state using standard Driven Ports mimicking Event Buses.
1. App A produces `WorkOrderCreated` (Event).
2. App A calls the Driven Port `compliance_events_port`.
3. An Adapter bridges this seamlessly to App B (`compliance`), feeding the payload sequentially to App B's internal Use Case.

*(Eventually allowing scaling to asynchronous brokers with an Outbox Pattern, without disrupting Domain business boundaries.)*

---

## 6. Database Query Conventions (Where should queries go?)

In this architecture, database queries are managed pragmatically to balance **Active Record** convenience with strict **Hexagonal** boundaries.

### Scenario 1: Intra-App Queries (Your Own Bounded Context)
You are permitted to use the Django ORM directly. Since the models act as Aggregate Roots, they inherently manage their own state boundaries.
- **Where (Simple)**: Inside `application/use_cases/` for basic retrieval (e.g., fetching an entity by ID to mutate it).
- **Where (Complex)**: Kept in custom **QuerySets/Managers** alongside the Entity in `domain/entities/<model>.py`. The Use Case orchestrates by calling these methods (e.g., `User.objects.active_in_region()`).

### Scenario 2: Inter-App Queries (Another Bounded Context)
If App A requires data belonging to App B, **you cannot import App B's models or execute DB queries against its tables directly.** Doing so violates the modular boundaries.
- **Where**: Inside `infrastructure/adapters/`.
- **How**: The Use Case leverages an interface (Driven Port). The Adapter implements it, fetching the data (usually by invoking App B's exposed Use Case), and returns it strictly mapped into a cross-boundary **DTO**.

### Scenario 3: Complex Read-Only Queries (CQRS Pattern)
For dashboards or massive reports joining multiple tables, loading rich Domain Entities (Aggregates) into memory is severely inefficient.
- **Where**: Inside `application/services/` (or a dedicated `application/queries/` namespace).
- **How**: It is fully acceptable to bypass the Domain Entity logic entirely here. Leverage optimized ORM methods like `.values()` and `.annotate()`, returning raw dictionaries or DTO lists directly to the Presentation layer exclusively for displaying data.

---

## 7. Exception & Error Handling Strategy

The system uses a **Hybrid Pattern heavily leaning on Custom Exceptions**.

### 1. Domain Layer (Raising)
- Entities (`.clean()`) raise `ValidationError` or specific `DomainError` (e.g., `InvalidWorkOrderStatusTransition`) when a business rule is broken.
- Define exceptions in `domain/exceptions.py` by inheriting from `proyecto3.apps.core.domain.exceptions.DomainError`.

### 2. Application Layer (Bubbling)
- Use Cases let `DomainError` and `ValidationError` bubble up.
- For commands, if a lookup fails, raise a `ResourceNotFoundError` (inheriting from `DomainError`).
- For pure queries, returning `None` or `[]` is acceptable instead of raising.

### 3. Infrastructure Layer (Transforming)
- Adapters must **NEVER** leak infrastructure exceptions into the Application Layer.
- Catch external exceptions and raise a mapped `DomainError`.

### 4. Presentation Layer (Handling)
- Views do **not** use `try/except`.
- A global DRF exception handler (`core/presentation/api/exception_handler.py`) catches `DomainError` and `ValidationError`, translating them into standardized HTTP 400/404 JSON responses.

---

## 8. Security & Permissions Architecture (RBAC)

To leverage Django's built-in `auth` permission system while maintaining our strict Hexagonal isolation, we employ the following strategy:

### 1. App-Specific Permissions (Value Objects)
Each Bounded Context dictates its own permission definitions. We map Django's native permission strings (e.g., `app_label.action_model`) into typed Value Objects (Enums).
- **Location:** `domain/value_objects/permissions.py`
- **Example:** `class RolePermissions(str, Enum): ADD_ROLE = "companies.add_role"`
This guarantees the App securely defines the boundaries of its rules, while utilizing standard Python types.

### 2. The `users` App as the IAM Provider
The `users` (Identity & Access) context natively manages the Django `User` identities. It considers external permission queries as abstract string tokens.
- **Inbound Driver Ports**: The `users` app exposes Use Cases to query and modify privileges (e.g., `ICheckPermissionUseCase(user_id, permission_string)`).
- **Internal Logic**: These Use Cases interact closely with the native Django mechanism: `user.has_perm(permission_string)`.
- **Endpoints**: The `users` app controls the HTTP REST APIs dictating role/permission assignments, securely isolated from business domains.

### 3. Crossing the Boundary for Deep Domain Authorization
When a business logic boundary must verify a user holds authorization based on deep business rules (e.g., *Can this user approve this specific $10,000 work order?*), it utilizes Hexagonal patterns.
- **Driven Port**: `maintenance` declares an `IAuthorizationPort(ABC)` interface asking: "Is this user allowed to perform `MaintenancePermissions.APPROVE_WORK_ORDER`?".
- **Adapter**: `maintenance`'s infrastructure adapter executes the external call, feeding the typed Value Object string to the `users` app Use Case.

### 4. Edge Authorization (Views)
Reject unauthorized access at the HTTP Edge using DRF Permission Classes in the View's `get_permissions()`.
- **Global Permissions:** Use `CorePermission(app="...", permission_to_check=...)`.
- **Tenant Isolation:** Include `TenantScopedPermission()` in the permission classes. This intercepts the nested `company_pk` URL parameter and verifies that the logged-in user holds an active membership to that specific tenant before routing the request to the View logic.
- **Why this respects the architecture**: The Presentation Layer represents an "Inbound Adapter". Its job is to handle HTTP requests. It is perfectly valid for it to check the requester's native permissions and reject them before ever instantiating a Domain Use Case.

---

## 9. Testing Strategy & Implementation

### 1. Test Suite Structure
Tests are isolated within each app's `tests/` directory. Use `pytest`.
- **Unit Tests:** For Entities, Value Objects, Services.
- **Integration Tests:** For Use Cases and Views.

### 1.1 Running the suite (parallel by default)
`pytest-xdist` is installed, so **the full suite always runs parallelized**:
```bash
uv run pytest -n auto          # full suite — every worker gets its own test database
```
Coverage aggregates across workers, so the `--cov-fail-under=80` gate still applies under `-n auto`. Do not
run the whole suite serially.

Targeted runs stay **serial** (xdist's worker startup costs more than it saves on one file) and must pass
`--no-cov`, since the global `--cov-fail-under=80` would otherwise fail an isolated file whose tests all pass:
```bash
uv run pytest proyecto3/apps/<app>/tests/presentation/views/test_<model>.py -v --no-cov
```
Because the suite is parallel, tests must be **order-independent**: no test may depend on another having run
first, and none may share module-level mutable state or assume specific auto-increment ids / `factory.Sequence`
values. Order-dependent tests pass serially and flake under `-n auto`.

### 2. Factories
Use `factory_boy` located in `factories/` to generate fixtures.
- Factories must use `DjangoModelFactory`.
- Never use direct ORM creation (`User.objects.create()`) inside tests; always use factories (`UserFactory()`).
- Tenant entities must be explicitly linked to a `CompanyFactory`.

### 3. View Testing (Symmetry)
- Exhaustively test `ViewSet` actions.
- Ensure testing covers edge cases, cross-tenant isolation, RBAC security (permissions), state-transition validations, and filtering capabilities.

---

## 10. Database Seeding & Teardown Architecture

The platform provides a robust abstraction for local environments and tests via the `system` app.

### Data Teardown (`cleandb`)
- Uses a `DependencyResolver` to automatically inspect `model._meta.get_fields()`.
- Generates a topological directed graph, mapping models from leaf to root.
- Safely deletes test data across apps in a way that inherently avoids database `IntegrityError` from Foreign Key or M2M constraints.
- **Setup for new models:** **None!** `cleandb` is entirely dynamic. As long as your model has standard Django `ForeignKey` definitions, it will automatically be detected and deleted in the correct order.

### Data Seeding (`initdb`)
- Exposes an extensible `GeneratorRegistry` where custom data generators inherit from `BaseGenerator`.
- Generators declare a `depends_on=[]` array, enabling the engine to resolve the correct topological execution order automatically.
- **Strict Domain Compliance:** Bypassing boundaries using silent `.bulk_create()` is prohibited. All registered generators must directly interface with formal Application Use Cases, Factories, and execute `.full_clean()`.
- **Keep the showcase company curated:** generators that pick parents across companies must exclude the
  curated demo company — `.exclude(name=SHOWCASE_COMPANY_NAME)` / `.exclude(company__name=SHOWCASE_COMPANY_NAME)`
  (constant in `generators/base.py`) — so random seed data never lands in the `showcase_company` inventory.

### How to Add a Generator for a New Model
1. **Create the Generator Class:**
   - Create a new file in `proyecto3/apps/system/application/services/generators/` (e.g., `equipment_type.py`).
   - Inherit from `BatchGenerator` (or `SingletonGenerator` / `ContextualGenerator`).
   - Decorate the class with `@register_generator(name="equipment_type", depends_on=["company"])` to insert it into the topological graph.
   - Implement the `generate()` method to pull required dependencies, use `self.rand_count(count)`, and build the records using the `EquipmentTypeFactory` or `CreateEquipmentTypeUseCase`.
   - Exclude the showcase company from every cross-company pool (see the note above; mirror `system.py` or `work_order.py`).

   ```python
   from proyecto3.apps.system.application.services.generators.base import BatchGenerator
   from proyecto3.apps.system.application.services.generators.registry import register_generator

   @register_generator(name="equipment_type", depends_on=["company", "superadmin"])
   class EquipmentTypeGenerator(BatchGenerator):
       def generate(self, count: int, **__: object) -> list[EquipmentType]:
           self.log_start(f"Generating {count} equipment types...")
           # Implementation fetching dependencies and creating data...
   ```

2. **Configure `initdb` Arguments:**
   - Open `proyecto3/apps/system/presentation/cli/management/commands/initdb.py`.
   - In the `add_arguments()` method, add the command line option for your generator's count:
     ```python
     parser.add_argument("--equipment-types", type=int, default=10, help="Number of equipment types to generate")
     ```
   - In the `handle()` method, extract the option and map it to your generator's registry name in the `counts` dictionary:
     ```python
     counts: dict[str, int] = {
         ...
         "equipment_type": options.get("equipment_types", 10),
     }
     ```

---

## 11. Step-by-Step Implementation Guide

When implementing a new feature (e.g., "Role" in the companies app):

1. **Create the Entity (`domain/entities/role.py`)**:
   Inherit from `TenantModel` (or `CoreModel` if global). Define custom `TenantQuerySet`/`TenantManager`, override `clean()` for invariants.
2. **Define Permissions (`domain/value_objects/permissions.py`)**:
   Add specific enums like `ADD_ROLE`.
3. **Define the DTOs (`domain/dtos/role.py`)**:
   Create Pydantic `CreateRoleRequest`, passing `company_uuid` in the context if tenant-scoped.
4. **Define Driver Ports (`domain/ports/drivers/role.py`)**:
   Create `ICreateRoleUseCase(ABC)`.
5. **Implement the Service (`application/services/role.py`)**:
   Write the actual DB operations, ensuring you validate tenant context during filtering.
6. **Implement Use Cases (`application/use_cases/role.py`)**:
   Create classes implementing the Driver Ports that call the Service.
7. **Setup DI Providers (`presentation/providers/role.py`)**:
   Create `get_create_role_usecase()`.
8. **Create Serializers (`presentation/api/serializers/role.py`)**:
   Write serializers validating raw data into DTOs. If there are custom view actions, create specific request serializers (e.g., `PermissionsListRequestSerializer`).
9. **Create ViewSet (`presentation/api/views/role.py`)**:
   Implement `GenericViewSet`. Attach `TenantScopedPermission()` and `CorePermission` checks in `get_permissions()`. Extract `company_pk` from `self.kwargs`. Call the DI provider, execute the use case, and return the response.
10. **Implement Tests (`tests/`)**:
    Create a robust test suite ensuring RBAC and cross-tenant isolation rules work perfectly.
11. **Register Generators (Optional, `system/`)**:
    If necessary, register a `BaseGenerator` using `@register_generator()` mapping the generation loop directly to your new Driver Ports/Use Cases.

## Appendix: PDF rendering native dependencies (WeasyPrint)

Report PDF generation renders HTML with **WeasyPrint**, which needs the Pango/HarfBuzz native
libraries. The Docker image installs them (`libpango-1.0-0 libpangoft2-1.0-0 libharfbuzz0b
libharfbuzz-subset0 fonts-dejavu-core`). On macOS dev machines run:

```bash
brew install pango
```

The WeasyPrint import is **lazy** (inside the adapter's `convert()`), so `manage.py check`, mypy
and the test suite work without the native libs; only real PDF conversion requires them.
