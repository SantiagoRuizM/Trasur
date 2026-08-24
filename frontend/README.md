# Frontend Architecture Specification

## Goal

Implement a frontend using Domain-Driven Design (DDD) and Hexagonal Architecture (Ports & Adapters) for the Proyecto3 application.

The frontend should use:

- React
- TanStack Router
- React Query
- Zustand
- Shadcn UI
- Axios / Fetch
- Zod

The architecture must ensure:

- separation of concerns
- testability
- scalability
- framework isolation from domain logic

------

## Architecture Overview

### Layers

1. Presentation
    - React UI components, hooks, and state.
    - Responsible only for rendering and user interaction.
    - No business rules, no API calls.
2. Application
    - Use cases and orchestration.
    - Composes domain logic plus port-driven actions.
    - Pure functions that do not depend on React or UI frameworks.
3. Domain
    - Business logic, entities, value objects, domain services, errors.
    - Framework-agnostic, pure TypeScript.
4. Ports
    - Interfaces that declare dependencies to external systems.
    - Driven ports are implemented by infrastructure.
    - Driver ports are implemented by presentation.
5. Infrastructure
    - Adapters for API, repositories, storage, external services.
    - Implements driven ports.

### Port Types

- Driven ports: interfaces for external dependencies such as API clients, repository adapters, storage.
- Driver ports: entry points from UI into the application layer, typically hooks.

---

## Actual Project Structure

```text
src/
├── index.tsx
├── routeTree.gen.ts
├── routes/
│   ├── __root.tsx
│   ├── about.tsx
│   └── index.tsx
├── modules/
│   ├── auth/
│   │   ├── application/
│   │   │   ├── dtos/
│   │   │   │   └── index.ts
│   │   │   ├── index.ts
│   │   │   └── usecases/
│   │   │       └── index.ts
│   │   ├── domain/
│   │   │   ├── contants/
│   │   │   │   └── index.ts
│   │   │   ├── entities/
│   │   │   │   └── index.ts
│   │   │   ├── errors/
│   │   │   │   └── index.ts
│   │   │   ├── ports/
│   │   │   │   └── index.ts
│   │   │   ├── services/
│   │   │   │   └── index.ts
│   │   │   └── value_objects/
│   │   │       └── index.ts
│   │   ├── infrastructure/
│   │   │   ├── api/
│   │   │   │   └── index.ts
│   │   │   ├── index.ts
│   │   │   ├── repositories/
│   │   │   │   └── index.ts
│   │   │   └── storage/
│   │   │       └── index.ts
│   │   └── presentation/
│   │       ├── components/
│   │       │   └── index.ts
│   │       ├── hooks/
│   │       │   └── index.ts
│   │       └── stores/
│   │           └── index.ts
│   ├── companies/
│   │   ├── application/
│   │   │   ├── dtos/
│   │   │   │   └── index.ts
│   │   │   ├── index.ts
│   │   │   └── usecases/
│   │   │       └── index.ts
│   │   ├── domain/
│   │   │   ├── contants/
│   │   │   │   └── index.ts
│   │   │   ├── entities/
│   │   │   │   └── index.ts
│   │   │   ├── errors/
│   │   │   │   └── index.ts
│   │   │   ├── ports/
│   │   │   │   └── index.ts
│   │   │   ├── services/
│   │   │   │   └── index.ts
│   │   │   └── value_objects/
│   │   │       └── index.ts
│   │   ├── infrastructure/
│   │   │   ├── api/
│   │   │   │   └── index.ts
│   │   │   ├── index.ts
│   │   │   ├── repositories/
│   │   │   │   └── index.ts
│   │   │   └── storage/
│   │   │       └── index.ts
│   │   └── presentation/
│   │       ├── components/
│   │       │   └── index.ts
│   │       ├── hooks/
│   │       │   └── index.ts
│   │       └── stores/
│   │           └── index.ts
│   ├── customers/
│   │   ├── application/
│   │   │   ├── dtos/
│   │   │   │   └── index.ts
│   │   │   ├── index.ts
│   │   │   └── usecases/
│   │   │       └── index.ts
│   │   ├── domain/
│   │   │   ├── contants/
│   │   │   │   └── index.ts
│   │   │   ├── entities/
│   │   │   │   └── index.ts
│   │   │   ├── errors/
│   │   │   │   └── index.ts
│   │   │   ├── ports/
│   │   │   │   └── index.ts
│   │   │   ├── services/
│   │   │   │   └── index.ts
│   │   │   └── value_objects/
│   │   │       └── index.ts
│   │   ├── infrastructure/
│   │   │   ├── api/
│   │   │   │   └── index.ts
│   │   │   ├── index.ts
│   │   │   ├── repositories/
│   │   │   │   └── index.ts
│   │   │   └── storage/
│   │   │       └── index.ts
│   │   └── presentation/
│   │       ├── components/
│   │       │   └── index.ts
│   │       ├── hooks/
│   │       │   └── index.ts
│   │       └── stores/
│   │           └── index.ts
│   └── users/
│       ├── application/
│       │   ├── dtos/
│       │   │   └── index.ts
│       │   ├── index.ts
│       │   └── usecases/
│       │       └── index.ts
│       ├── domain/
│       │   ├── contants/
│       │   │   └── index.ts
│       │   ├── entities/
│       │   │   └── index.ts
│       │   ├── errors/
│       │   │   └── index.ts
│       │   ├── ports/
│       │   │   └── index.ts
│       │   ├── services/
│       │   │   └── index.ts
│       │   └── value_objects/
│       │       └── index.ts
│       ├── infrastructure/
│       │   ├── api/
│       │   │   └── index.ts
│       │   ├── index.ts
│       │   ├── repositories/
│       │   │   └── index.ts
│       │   └── storage/
│       │       └── index.ts
│       └── presentation/
│           ├── components/
│           │   └── index.ts
│           ├── hooks/
│           │   └── index.ts
│           └── stores/
│               └── index.ts
├── shadcn/
│   ├── components/
│   │   └── ui/
│   │       └── card.tsx
│   └── lib/
│       └── utils.ts
├── shared/
│   ├── components/         # reusable UI primitives (Modal, StatCard, Pill, EmptyState, Toggle)
│   ├── lib/                # pure helpers (e.g. initials.ts)
│   └── types/              # code-generated API types/SDK (do not edit by hand)
└── styles/
    └── global.css
```

> Note: The module layout is the actual structure used in this repository.

---

## Layer Responsibilities in This Codebase

### Domain

Directory: `src/modules/<module>/domain`

Contains:

- `entities/` — business entities and models
- `value_objects/` — domain value objects and validations
- `services/` — pure domain services
- `errors/` — domain-specific errors
- `ports/` — driven port interfaces
- `contants/` — module constants used by domain or application

Rules:

- No React, no HTTP, no Zustand.
- No application orchestration.
- Only domain business rules and invariants.

Example driven ports:

```ts
export interface AuthRepository {
    login(email: string, password: string): Promise<User>;
}

export interface TokenStorage {
    save(token: string): Promise<void>;
}
```

### Application

Directory: `src/modules/<module>/application`

Contains:

- `usecases/` — feature use cases
- `dtos/` — input/output data shapes
- `index.ts` — module use-case exports

Rules:

- Use cases compose domain logic and ports.
- Use cases remain framework-agnostic.
- No React components, no hooks, no UI state.

Example use case:

```ts
export const login =
    (authRepo: AuthRepository, tokenStorage: TokenStorage) =>
    async (input: { email: string; password: string }) => {
        const user = await authRepo.login(input.email, input.password);

        if (!user.token) {
            throw new Error("Invalid login");
        }

        await tokenStorage.save(user.token);
        return user;
    };
```

### Infrastructure

Directory: `src/modules/<module>/infrastructure`

Contains:

- `api/` — HTTP adapter functions
- `repositories/` — repository adapter implementations
- `storage/` — persistence adapters
- `index.ts` — infrastructure exports and wiring

Responsibility:

- Implement driven ports from domain/application.
- Translate API responses into domain entities.
- Hide side effects behind port interfaces.

Example API adapter:

```ts
export const loginRequest = async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
        throw new Error("API error");
    }

    return res.json();
};
```

Example repository implementation:

```ts
export class AuthRepositoryImpl implements AuthRepository {
    constructor(private readonly api: AuthApi) {}

    async login(email: string, password: string) {
        const data = await this.api.loginRequest(email, password);
        return User.fromPrimitives(data);
    }
}
```

### Presentation

Directory: `src/modules/<module>/presentation`

Contains:

- `components/` — UI-only React components
- `hooks/` — driver adapters from UI into application use cases
- `stores/` — Zustand state slices for UI/app state

Rules:

- Components render UI only.
- Hooks orchestrate use-case calls and map results into state.
- Stores contain client state, not domain logic.

Example hook:

```ts
export const useLogin = () => {
    const authRepo = useAuthRepository();
    const tokenStorage = useTokenStorage();
    const setUser = useAuthStore((state) => state.setUser);

    const mutation = useMutation({
        mutationFn: login(authRepo, tokenStorage),
        onSuccess: (user) => setUser(user),
    });

    return {
        login: mutation.mutate,
        isLoading: mutation.isLoading,
        error: mutation.error,
    };
};
```

### Routes

Directory: `src/routes`

Responsibility:

- Define route paths and layout composition for TanStack Router.
- Connect presentation pages to routes.

Example:

```ts
export const loginRoute = createRoute({
    path: "/login",
    component: LoginPage,
});
```

### Shared

Directory: `src/shared`

Contains cross-module, framework-light code:

- `types/` — code-generated API types/SDK (`@hey-api/openapi-ts`). **Never edit by hand** — run `npm run getautotypes`.
- `lib/` — small pure helpers (e.g. `initials.ts`).
- `components/` — reusable presentation primitives shared by every feature page (see ["Shared UI Primitives & Presentation Conventions"](#shared-ui-primitives--presentation-conventions)).

---

## Shared UI Primitives & Presentation Conventions

The presentation layer is intentionally thin and **DRY**: list/CRUD pages are
assembled from a small set of shared primitives in `src/shared/components/`
rather than re-implementing chrome per page. Reusing these is the default —
do not hand-roll a card, badge, dialog or empty state inside a page.

### Shared primitives (`src/shared/components/`)

| Component    | Purpose                                                  | Notes / guarantees                                                                                                                                                                                                                                                                                                                                                  |
| ------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Modal`      | Dialog shell (header + scrollable body + sticky footer). | **Accessible by default**: closes on `Escape`, locks background scroll, traps `Tab` focus, restores focus to the previously focused element on close, exposes `role="dialog"` / `aria-modal` / `aria-labelledby`, and only closes on a backdrop press that both starts _and_ ends on the backdrop. Pass `title`, optional `subtitle`, `footer` actions and `width`. |
| `StatCard`   | Single KPI card (label + value + optional tone pill).    | **One source of truth** for KPI strips across Clients, Planning, Assets and Reports — do not re-create. `tone` reuses `PillTone`. `hint` is optional.                                                                                                                                                                                                               |
| `Pill`       | Flat status/category badge.                              | Tones: `success` / `warning` / `destructive` / `info` / `muted`, optional status `dot`. The `PillTone` type is the shared tone vocabulary (used by `StatCard` too).                                                                                                                                                                                                 |
| `EmptyState` | No-data / no-results placeholder.                        | Pass an `icon`, `title`, optional `description` and `action`. Use `bare` to render inside an existing bordered card (e.g. under a table header).                                                                                                                                                                                                                    |
| `Toggle`     | Flat on/off switch.                                      | Controlled (`checked` + `onChange`).                                                                                                                                                                                                                                                                                                                                |

### Standard list / CRUD page layout

Every resource page follows the same top-to-bottom shape (see
`modules/customers/.../ClientsPage.tsx` and `modules/subsystems/.../SubsystemsPage.tsx`):

1. **KPI strip** — a responsive grid of `StatCard`s.
2. **Filter bar** — search `<input>` + `<select>`s + a "Restablecer" `Button`
   (disabled when no filter is active).
3. **Header row** — `h2` title · count, subtitle, and the **primary action
   button on the right** (`Nueva sede`, `Generar informe`, …). Primary actions
   live here, **not** inside the table or empty state.
4. **Table / grid** — renders rows, or `EmptyState` when empty.
5. **Modal** — gated behind local `useState`, built with the `Modal` shell.

The page itself owns filtering/derived state; the AppHeader title/subtitle come
from `PAGE_HEADERS` in `modules/dashboard/presentation/navigation.ts`, so pages
do not repeat the page-level `<h1>`.

### Tailwind: utilities are generated on demand ⚠️

Tailwind v4 only emits a utility class if its **literal string is found during
a content scan**. Two consequences to design around:

- **Never build class names from fragments** (`` `bg-${tone}` ``,
  `` `grid-cols-${n}` ``). They won't be generated. Map to **complete** class
  strings instead (see `Pill`/`StatCard` tone maps).
- A brand-new utility that appears **nowhere else** in the app can silently
  fail to appear in a _running_ dev server (HMR doesn't always pick up a
  first-time class) — the layout breaks with **no error**. If a new class looks
  ignored, **restart `npm run dev`**. For a non-static column count, prefer an
  inline `gridTemplateColumns` style (e.g. `repeat(5, minmax(0, 1fr))`) over a
  rare utility like `grid-cols-5` — this is what the Reports KPI strip does.

### Accessibility conventions

- Inputs/selects with only a placeholder must carry an `aria-label`
  (filter search boxes and filter dropdowns do).
- Icon-only buttons (close, row menus) must carry `aria-label` / `title`.
- Dialogs use the `Modal` primitive so focus, scroll-lock and `Escape` are
  handled centrally — do not build ad-hoc modals.

### Design tokens

Use semantic Tailwind tokens mapped from the Gestiion palette in
`src/styles/global.css` (`bg-card`, `border-border`, `text-foreground`,
`text-muted-foreground`, `bg-success/10 text-success`, `bg-warning/10`,
`bg-destructive/10`, `bg-accent`, `bg-sidebar`, the `bg-main-gradient` utility,
etc.). Avoid hard-coded hex values; the tokens drive light/dark mode.

---

## End-to-End Feature Implementation

To implement a feature in this frontend, follow these steps:

1. Define domain entities, value objects, errors, and ports.
    - Add domain rules in `src/modules/<module>/domain`.
    - Add interfaces for external dependencies in `src/modules/<module>/domain/ports`.

2. Add application use cases.
    - Put business flows in `src/modules/<module>/application/usecases`.
    - Define input/output shapes in `src/modules/<module>/application/dtos`.

3. Implement infrastructure adapters.
    - Add API calls in `src/modules/<module>/infrastructure/api`.
    - Implement repository classes in `src/modules/<module>/infrastructure/repositories`.
    - Add storage adapters in `src/modules/<module>/infrastructure/storage`.

4. Build presentation layer.
    - Create UI components in `src/modules/<module>/presentation/components`.
    - Create hooks in `src/modules/<module>/presentation/hooks`.
    - Manage local UI state in `src/modules/<module>/presentation/stores`.

5. Wire the module.
    - Export the module public API from `src/modules/<module>/index.ts`.
    - Add route definitions in `src/routes`.
    - Use `src/routeTree.gen.ts` if required by the router.

6. Inject dependencies.
    - Provide concrete infrastructure implementations to use cases from module composition.
    - Prefer module wiring in `src/modules/<module>/index.ts` or route/provider setup.

7. Keep the flow clean.
    - UI → hook → use case → domain + ports → infrastructure → response → hook → store → UI

---

## Example Module Skeleton

```text
src/modules/<module>/
├── application/
│   ├── dtos/
│   │   └── index.ts
│   ├── index.ts
│   └── usecases/
│       └── index.ts
├── domain/
│   ├── contants/
│   │   └── index.ts
│   ├── entities/
│   │   └── index.ts
│   ├── errors/
│   │   └── index.ts
│   ├── ports/
│   │   └── index.ts
│   ├── services/
│   │   └── index.ts
│   └── value_objects/
│       └── index.ts
├── infrastructure/
│   ├── api/
│   │   └── index.ts
│   ├── index.ts
│   ├── repositories/
│   │   └── index.ts
│   └── storage/
│       └── index.ts
└── presentation/
    ├── components/
    │   └── index.ts
    ├── hooks/
    │   └── index.ts
    └── stores/
        └── index.ts
```

---

## Implementation Rules

### Forbidden

- No business logic in React components.
- No API calls in components.
- No domain logic inside Zustand stores.
- No React or framework dependencies in domain/application layers.
- No direct data fetching in presentation components.

### Required

- All external dependencies must go through ports.
- Use cases must be pure and testable.
- Domain must remain framework-agnostic.
- Hooks must only orchestrate UI interaction and use case invocation.
- Infrastructure must implement ports and hide side effects.

---

## How a Feature Flows

1. User interacts with a UI component.
2. Component calls a presentation hook.
3. Hook calls an application use case.
4. Use case uses domain logic and driven port interfaces.
5. Infrastructure implements driven ports and performs side effects.
6. Response flows back through the use case and hook.
7. Hook updates stores or local state.
8. UI rerenders.

---

## Notes for This Repository

- `src/index.tsx` is the app bootstrap.
- `src/routes` contains path and page wiring.
- `src/routeTree.gen.ts` is generated router tree data.
- `src/modules/*` contains module-specific domain/application/infrastructure/presentation.
- `src/shadcn` contains shared UI components and utilities.
- `src/shared` contains shared types and common utilities.
- `src/styles/global.css` contains global styling.
