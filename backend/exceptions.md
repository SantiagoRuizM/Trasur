# Error & Exception Handling Strategy for DDD in Django

This document analyzes the best strategies for handling errors and exceptions in the Proyecto3 Management Platform, given the established Domain-Driven Design (DDD) and Hexagonal Architecture implemented with Django and DRF.

## 1. Analysis of Available Strategies

When managing errors in a Python/Django DDD project, developers generally choose between three paradigms:

### A. The "Result" / "Maybe" Monad Pattern (Functional)
**Concept:** Methods never raise exceptions for expected business failures. Instead, they return a typed object like `Result[ValueType, ErrorType]` or `Optional[ValueType]`.
- **Pros:**
  - Extremely explicit. The type signature tells the caller exactly what can go wrong.
  - Forces the caller to handle the error (no hidden GOTO jumps in the control flow).
- **Cons:**
  - **Friction with Django:** Django natively raises exceptions (`ObjectDoesNotExist`, `ValidationError`, `IntegrityError`). Wrapping every ORM call and framework feature in a `Result` monad introduces massive boilerplate.
  - Requires third-party libraries (like `returns`) and adds a high cognitive load for standard Python developers who expect exception-based control flow.

### B. The "Pure Exception" Pattern (Idiomatic Python)
**Concept:** Business invariants and failures are modeled as explicit Exception classes. You raise exceptions when rules are violated, and let them bubble up to be handled at the system edge.
- **Pros:**
  - Very idiomatic in Python ("Easier to ask for forgiveness than permission").
  - Maps perfectly to Django's ORM and DRF's exception handling mechanisms.
  - Keeps code extremely clean and avoids `if not result.is_success:` boilerplate everywhere.
- **Cons:**
  - Hidden control flow. You must rely on documentation to know what a function might raise.

### C. The "Hybrid" Layer-Specific Pattern
**Concept:** Use the right tool for the specific architectural layer, blending functional types (`Optional`) where appropriate with exceptions for invariant violations.

---

## 2. Recommended Strategy for this Project

Given the architectural blueprint (Active Record with Aggregate Discipline, DRF for presentation), the **Hybrid Pattern heavily leaning on Custom Exceptions** is definitively the best approach.

Using full `Result` monads will fight against Django's ORM (especially inside your `clean()` methods) and make the codebase hard to maintain.

### Recommended Layer-by-Layer Implementation:

#### 1. Domain Layer (Entities & Value Objects)
**Strategy: Raise Domain Exceptions / Validation Errors**
- Since your Entities are Django Models and rely on `.clean()` to enforce invariants, you should raise `django.core.exceptions.ValidationError` or specific **Domain Exceptions** (e.g., `InvalidWorkOrderStatusTransition`) when a business rule is broken.
- *Do not* return `Result` types here, because the ORM naturally uses exceptions to halt saving invalid state.

#### 2. Domain Exceptions Structure
Create a dedicated `exceptions.py` inside the `domain/` folder of each bounded context.
- Base them on a `CoreDomainException` from your `core/` app.
- Examples: `EquipmentNotAvailableError`, `UserDeactivatedError`.

#### 3. Application Layer (Use Cases)
**Strategy: Let Domain Exceptions bubble up, Raise specific Use Case Exceptions**
- Use Cases orchestrate flow. If an Entity raises a domain exception during `.clean()`, the Use Case should **let it bubble up**.
- If a Use Case cannot find something, should it raise `DoesNotExist` or return `None`?
  - **Commands (Mutations):** If a Use Case fails because an ID provided is invalid, raise a `ResourceNotFoundError` (inheriting from CoreDomainException). Commands should succeed or raise an exception.
  - **Queries (Reads):** If a Use Case is purely fetching data (CQRS pattern) and doesn't find it, returning `Optional[DTO]` or an empty list `[]` is perfectly acceptable and cleaner than raising exceptions.

#### 4. Infrastructure Layer (Adapters)
**Strategy: Catch external errors, wrap and raise internal Domain Exceptions**
- Adapters deal with the outside world (HTTP requests, AWS, another bounded context). They will encounter infrastructure errors (e.g., `requests.exceptions.Timeout`).
- **Rule:** Adapters must **NEVER** leak infrastructure exceptions into the Application Layer.
- **Implementation:** Catch the external exception, and raise a generic or specific Domain Exception.
  ```python
  try:
      response = requests.get(...)
  except requests.Timeout:
      # Wrapping in a domain-friendly exception
      raise ExternalServiceUnavailableError("Maintenance CRM timed out.")
  ```

#### 5. Presentation Layer (DRF Views & APIs)
**Strategy: Global Exception Handler**
- Do not wrap every Use Case execution in a `try/except` block inside your DRF Views. This leads to fat views and duplicate code.
- **Implementation:** Create a custom DRF exception handler in `core/presentation/api/exception_handler.py`.
- This handler will catch your `CoreDomainException` and automatically translate it into the correct HTTP 400 (Bad Request) or 404 (Not Found) with a standardized JSON error format.
- Your views remain thin:
  ```python
  def create(self, request):
      # If this raises a DomainException, DRF's global handler catches it
      # and returns a clean HTTP 400 response.
      use_case = get_create_user_usecase()
      result = use_case.execute(dto)
      return Response(result)
  ```

## 3. Summary of the Workflow

1. **Entities** raise `ValidationError` or `DomainException` to protect invariants.
2. **Adapters** catch `requests.Timeout` (or similar) and raise `DomainException`.
3. **Use Cases** orchestrate, occasionally raising `DomainException` or returning `Optional` for pure queries.
4. **Views** call Use Cases directly with zero exception handling logic.
5. **DRF Global Exception Handler** catches all `DomainExceptions` escaping the Use Cases and translates them into HTTP 400/403/404 responses.

This strategy respects Django's nature, keeps your Use Cases and Views extremely thin, explicitly protects your domain boundaries, and provides a uniform error interface to your frontend.
