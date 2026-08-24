# Proyecto3 Management Platform - Backend Architecture Blueprint

This document specifies the definitive architectural blueprint for the backend of the Proyecto3 Management Platform. It serves as an exhaustive guide regarding the design boundaries, layer responsibilities, and specific implementations using **Domain-Driven Design (DDD)**, **Hexagonal Architecture (Ports & Adapters)**, **Active Record with Aggregate Discipline**, **Dependency Inversion Principle (DIP)**, and **Modularity**, natively adapted for the Django Framework.

The source of truth for these paradigms across the application ecosystem is demonstrated entirely within the `users` (Identity & Access) app.

---

## 1. Architectural Philosophy & Strategy

This project eschews standard unstructured Django implementations ("Fat Models, Fat Views"). Instead, it embraces a **Modular Monolith** structure where application complexity is rigorously controlled through decoupling.

### Key Tenets
1. **Bounded Contexts = Django Apps**: Each Django app represents a strictly isolated bounded context (e.g., `asset_registry`, `maintenance_operations`, `users`).
2. **No Direct Import Between Contexts**: Direct cross-app ORM imports or model lookups are strictly prohibited. The system interacts *only* through established contracts.
3. **Hexagonal Boundaries (Ports & Adapters)**: Business application limits are defined by "Ports" (Interfaces). Any interaction bridging an app boundary utilizes "Adapters".
4. **Behavioral Active Record & Aggregate Discipline**: Domain Entities mirror Django Models to harness the ORM capabilities but are enriched with business behaviors enforcing aggregate invariants.
5. **DIP (Dependency Inversion Principle)**: Implementations depend on abstractions. Dependency injection is managed within the Presentation layer to construct application Use Cases automatically.

---

## 2. Anatomy of a Bounded Context

Below is the standard layout mapped to any domain app inside `backend/proyecto3/apps/<context>/`. It ensures a complete separation between domain knowledge, application flow, and infrastructure concerns.

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
│   ├── entities/            # Django Models (Entities/Aggregates) inheriting from core.CoreModel
│   ├── value_objects/       # Immutable structures (Money, Measurements, FunctionalLocation)
│   ├── exceptions/          # Pure domain errors
│   ├── events/              # Domain Event definitions (Dataclasses)
│   └── ports/
│       ├── drivers/         # INBOUND PORTS: Interfaces declaring what the app CAN DO
│       └── driven/          # OUTBOUND PORTS: Interfaces declaring what the app NEEDS
│
├── application/             # LAYER 2: Application orchestrated flows
│   ├── use_cases/           # Implementation of Inbound Driver Ports
│   └── services/            # Complex boundary processes (e.g., specific algorithms)
│
├── infrastructure/          # LAYER 3: Outbound connectivity and integrations
│   └── adapters/            # Implementations of Outbound Driven Ports
│
├── presentation/            # LAYER 4: Inbound external access (HTTP, CLI, UI)
│   ├── api/
│   │   ├── filters/         # Request parameters filtering
│   │   ├── serializers/     # Input validation, strictly mapping onto DTOs
│   │   └── views/           # DRF ViewSets / Entrypoints
│   └── providers/           # Dependency Injection wiring (creating use-cases with adapters)
│
├── factories/               # Data seeding factories
└── tests/                   # Test suite for this bounded context
```

---

## 3. Core Structural Layers

### 🔵 Domain Layer (`domain/`)
The epicenter of the logic. It does not possess any framework configurations except for Active Record mappings.

- **Entities (`domain/entities/`)**: Django models live here instead of the root directory. They define fields but critically embed **business invariants**, overriding `clean()` entirely over unstructured updates.
  - *Example (`users.domain.entities.user.py`)*: Defines the `User` representation, overrides managers, sets logical status transitions.
- **DTOs (`domain/dtos/`)**: Typed classes (Pydantic / Dataclasses) used to serialize inputs and pass them deep into the application safely without leaking HTTP constraints.
- **Ports (`domain/ports/`)**:
    - **Driver Ports (`drivers/`)**: The abstract APIs exposing the App to the world. E.g., `ICreateUserUseCase`.
    - **Driven Ports (`driven/`)**: Abstract dependencies. If a user workflow needs to check an Asset or process an external HTTP call, an interface goes here (e.g., `IEmailService`).

*(Note: While putting views or queries in models.py works in classic Django, we restrict our Entities to enforcing state boundaries strictly. The root `models.py` simply contains `from proyecto3.apps.users.domain.entities.user import User`.)*

### 🟡 Application Layer (`application/`)
Translates pure domain rules into executed state transitions.

- **Use Cases (`application/use_cases/`)**: They implement the Driver Ports exactly. They represent **User Intents** or **System Commands** (e.g., `CreateWorkOrder`, `AssignTechnician`).
  - **Role**: They are pure **Orchestrators**. A Use Case should simply: Fetch entities -> Invoke business rules -> Save entities.
  - **Rule #1 (No HTTP)**: Use cases never touch `<Request>` objects or Django Responses directly. They only interact with standard Python data structures and DTOs.
  - **Rule #2 (Never nest Use Cases)**: You should **NEVER** call Use Case A from Use Case B. Use Cases are entry points defining transaction boundaries. If two Use Cases share logic, that logic belongs in a Service.

- **Services (`application/services/`)**: Stateless classes or functions containing complex business rules that do not naturally fit inside a single Entity.
  - **Role**: Reusable logic blocks. While an Entity's `clean()` method manages rules for *that specific record*, a Service coordinates rules spanning *multiple* records or complex algorithms.
  - **Usage**: You implement the heavy lifting inside Services, and your Use Cases instantiate/call these Services. This guarantees logic is reusable across the context without incorrectly chaining Use Cases.

### 🔴 Presentation Layer (`presentation/`)
Interprets the outside world.

- **Views & Serializers (`presentation/api/`)**: `Serializer` logic is restrained to syntax validation and format manipulation (translating JSON → DTO). `Views` remain razor-thin.
- **Providers (`presentation/providers/`)**: This fulfills the **Dependency Inversion Principle**. It hosts injection functions like `get_create_user_usecase()`. When a View needs to create a user, it invokes the provider to receive an instantiated Use Case, decoupling the View from understanding how Use Cases are configured or which Infrastructure adapters they require.

### 🟢 Infrastructure Layer (`infrastructure/`)
Performs the technical scaffolding.

- **Adapters (`infrastructure/adapters/`)**: Implementations of Driven Ports. When your Application needs to speak to AWS, talk to an external Maintenance CRM, or cross a bounded context to lookup an `Asset`, an Adapter lives here.

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
If the `workforce` app needs to know if a practitioner is an active `User`, it mapping directly via ForeignKey `users.models.User` translates to high structural coupling.
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

## 7. Development Lifecycle Summary

1. To create a new feature inside an app: Start by defining the **DTO** representing input data in `domain/dtos/`.
2. Define the exact operational interface as a **Driver Port** in `domain/ports/drivers/`.
3. Construct the business workflow implementing that interface inside an **Application Use Case** (`application/use_cases/`). Do business rule modifications entirely within the **Aggregate Model (Entity)** it acts upon.
4. If it requires data beyond the app's tables or external actions, declare a **Driven Port** and create a specific **Adapter** inside `infrastructure/adapters/` yielding the required structure back to the Use Case.
5. Create a minimal DRF **View** and **Serializer** inside `presentation/api/`. Validate inputs into DTOs, fetch the Use Case instance using a **Provider** DI routine, and invoke `.execute()`.

By honoring this layout and the accompanying constraints, the software inherently prevents structural technical debt, achieves maximum testing feasibility via standard mocking at the adapter layers, and retains Django's fast lifecycle iterations.

---

## 8. Permissions & Authorization Architecture
To leverage Django's built-in `auth` permission system while maintaining our strict Hexagonal isolation, we employ the following strategy:

### 1. App-Specific Permissions as Value Objects
Each Bounded Context dictates its own permission definitions. We map Django's native permission strings (e.g., `app_label.action_model`) into typed Value Objects (Enums).
- **Where**: `maintenance_operations/domain/value_objects/permissions.py`
- **Example**:
  ```python
  from enum import Enum
  class MaintenancePermissions(str, Enum):
      CREATE_WORK_ORDER = "maintenance_operations.add_workorder"
      APPROVE_WORK_ORDER = "maintenance_operations.approve_workorder"
  ```
This guarantees the App securely defines the boundaries of its rules, while utilizing standard Python types.

### 2. The `users` App as the IAM Provider
The `users` (Identity & Access) context natively manages the Django `User` identities. It considers external permission queries as abstract string tokens.
- **Inbound Driver Ports**: The `users` app exposes Use Cases to query and modify privileges (e.g., `ICheckPermissionUseCase(user_id, permission_string)` and `IGrantPermissionUseCase`).
- **Internal Logic**: These Use Cases interact closely with the native Django mechanism:
  `user.has_perm(permission_string)` or `user.user_permissions.add(Permission.objects.get(codename=...))`
- **Endpoints**: The `users` app controls the HTTP REST APIs dictating role/permission assignments (`presentation/api/views/permissions.py`), securely isolated from business domains.

### 3. Crossing the Boundary for Deep Domain Authorization
When a business logic boundary must verify a user holds authorization based on deep business rules (e.g., *Can this user approve this specific $10,000 work order?*), it utilizes Hexagonal patterns.
- **Driven Port**: `maintenance` declares an `IAuthorizationPort(ABC)` interface asking: "Is this user allowed to perform `MaintenancePermissions.APPROVE_WORK_ORDER`?".
- **Adapter**: `maintenance`'s infrastructure adapter executes the external call, feeding the typed Value Object string to the `users` app Use Case (`get_check_permission_usecase()`).

This cleanly binds Django's native ORM capability with strict cross-boundary boundaries for deep logic.

### 4. Edge Authorization (Protecting Endpoints cleanly)
It is an **anti-pattern** to repeat Port/Adapter boilerplate for simple endpoint access checks. Endpoint access control is a **cross-cutting Presentation concern**.
You should reject unauthorized access at the HTTP Edge using **DRF Permission Classes** rather than cluttering your Use Cases.
- **Where**: Define custom DRF permissions in your app's `presentation/api/permissions.py`.
- **How**: Use the standard Django request directly inside the permission class: `return request.user.has_perm(MaintenancePermissions.CREATE_WORK_ORDER.value)`. Attach it to your DFR views (`permission_classes = [RequireMaintenancePermission]`).
- **Why this respects the architecture**: The Presentation Layer represents an "Inbound Adapter". Its job is to handle HTTP requests. It is perfectly valid for it to check the requester's native permissions and reject them before ever instantiating a Domain Use Case. Use Cases remain perfectly pure, and you avoid massive boilerplate.
