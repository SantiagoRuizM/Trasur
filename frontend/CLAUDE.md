# Frontend — Operating Manual

React 19 + TypeScript + Vite + Tailwind v4 + Shadcn, consuming the Django API. This is the operating manual:
the boundary rule, the architecture, the non-negotiable rules, and the exact commands. Per-module detail
lives in [modules.md](modules.md); the repo-wide picture (stack, Docker, both apps' commands) is in the
[root CLAUDE.md](../CLAUDE.md).

All frontend tooling runs from `./frontend`.

> **Bootstrap status.** `src/` has the folder tree and none of the code. The reference implementation of
> every pattern below — the canonical modules, the shared primitives, `apiError.ts`, `fetchAllPages.ts`,
> `logger.ts`, the router setup — is the sibling repo `../../Logistics/frontend/src/`. Copy from there;
> nothing needs renaming on the frontend side. The rules in this file apply from the first line of code you
> write, not once the app is "big enough".

---

## Hard boundary: never touch the backend

**If you are working as the frontend agent, you do not modify anything under `backend/`. Ever.**

This includes:

- Editing, creating, or deleting any file under `backend/` (models, views, serializers, migrations, tests).
- Running backend commands (`uv run ...`, `python manage.py ...`).
- Restarting, rebuilding, or stopping the backend Docker container(s) (`docker restart`, `docker compose ...`,
  `docker exec ...`).
- Modifying the database directly (migrations, seed data, `cleandb`/`initdb`) or the running container's state.

**Why:** the backend has its own owner and its own operating manual ([backend/CLAUDE.md](../backend/CLAUDE.md)).
Cross-boundary edits — even well-intentioned bug fixes discovered while testing a frontend change — take
ownership away from the person responsible for that code and can leave the shared dev environment (running
containers, applied migrations) in a state someone else has to clean up.

**What to do instead when the backend blocks frontend work** (e.g. an endpoint 404s/405s, a schema mismatch,
a migration error surfaces while testing against the live API):

1. Stop. Do not edit backend files or touch Docker/DB state to "get past it."
2. Diagnose and report clearly: what you tried, the exact error/response, the file and line in `backend/` you
   suspect, and why. A precise bug report is the deliverable — not a fix.
3. If regenerating `src/shared/types/` (`npm run getautotypes`) is blocked because the backend won't respond,
   say so and wait — do not hand-edit the generated types to compensate.

---

## Commands

```bash
npm run dev          # start Vite dev server
npm run build        # tsc -b && vite build
npm run typecheck    # tsc -b (project-references build; type-check only)
npm run lint         # eslint --fix
npm run format       # prettier --write
npm run test         # vitest run (single pass)
npm run test:watch   # vitest (watch mode)
npm run test -- src/modules/<module>/domain/services/index.test.ts   # single file
npm run test -- -t "maps the dto"                                    # single test by name
npm run test:e2e     # Playwright — live CRUD suite (dev server + backend must be up)
npm run getautotypes # regenerate src/shared/types/ from backend OpenAPI schema (backend must be running)
npm run precommit    # getautotypes + lint + format + typecheck (full local gate)
```

### Before every push

**Run the Playwright suite before pushing — every time.** Nothing else in this repo exercises the app
end to end: CI ([.github/workflows/checks.yml](../.github/workflows/checks.yml)) runs only `ci_prettier`,
`ci_lint`, `ci_typecheck` and `ci_build`, and **neither Vitest nor Playwright runs there**. If you don't
run them locally, nobody does.

```bash
cd frontend
npm run typecheck    # cheapest, catches the most
npm run lint
npm run test         # Vitest — no backend needed
npm run test:e2e     # Playwright — needs the dev server on :5173 and the backend on :8000
```

The first three need nothing running. `test:e2e` drives the real app against the real backend and real
seed data, so bring both up first (`docker compose up` at the repo root, `npm run dev` here — and reuse the
dev server already on 5173 rather than starting a second).

`lint` and `format` **mutate** files (`eslint --fix` / `prettier --write`). The `ci_*` variants
(`ci_lint`, `ci_prettier`, `ci_typecheck`, `ci_build`) are **check-only** — use them to verify without
rewriting the tree (`typecheck` is already non-mutating).

**Never start a second dev server if one is already up.** Check first (`netstat -ano | grep 517` on Windows,
or just hit `http://localhost:5173`) — Vite auto-picks 5174/5175/… when 5173 is busy instead of erroring, so
a duplicate silently spins up and adds confusion (extra processes, port drift, stale HMR state).

### Adding Shadcn components

```bash
cd frontend && npx shadcn@latest add <component>   # e.g. npx shadcn@latest add card
```

Shadcn primitives live in `src/shadcn/components/ui/`; **do not modify them directly.**

---

## Type generation

`src/shared/types/` is fully generated by `@hey-api/openapi-ts` from `http://localhost:8000/api/v1/schema/`
([openapi-ts.config.ts](openapi-ts.config.ts)). **Never edit files in that directory by hand** — regenerate
with `npm run getautotypes` (the backend must be running). Output:

- `sdk.gen.ts` — typed SDK functions (e.g. `authLoginCreate`)
- `client.gen.ts` — configured Axios client instance
- `types.gen.ts` — TypeScript interfaces matching backend serializers
- `@tanstack/react-query.gen.ts` — typed `useQuery`/`useMutation` hooks

---

## Testing

**Do not proactively browser-test with Claude-in-Chrome (or any live-browser automation) after a frontend
change.** Verify with `npm run typecheck`, `npm run lint`, and `npm run test` instead, and report what those
checks covered. Only drive the running app in a browser when the user explicitly asks for it in that turn.

Vitest + React Testing Library (`@testing-library/react` / `user-event` / `jest-dom`). Config in
[vitest.config.ts](vitest.config.ts): `jsdom` environment, the `@` → `src` alias, and `src/test/setup.ts` as
the setup file. **Vitest globals are off** — import `describe`/`it`/`expect`/`vi` from `vitest` explicitly in
every test. Tests are co-located next to source as `*.test.ts(x)` (e.g. `domain/services/index.test.ts`,
`presentation/components/<Thing>.test.tsx`, `shared/hooks/useDebouncedValue.test.ts`). Test domain services
as pure functions; test components through rendered behavior.

Note: under a sandboxed shell the `forks` pool can time out — **run the frontend test command with the
sandbox disabled.**

### End-to-end (Playwright)

`e2e/` holds a live CRUD suite: **one spec per entity**, each creating → reading → updating → deleting a
real record through the real UI against the running backend. It is the pre-push gate described above.
Detail — the coverage matrix, the fixtures, and the throttling caveat — belongs in
[e2e/README.md](e2e/README.md). The invariants to build in from spec one:

- **It writes to the shared dev database.** Name every record with an `E2E ` prefix, have each spec delete
  what it created (that *is* the D in CRUD), and add a `global.teardown.ts` that sweeps anything a failed
  run left behind.
- **Run it against a dedicated tenant**, not the showcase one — richly catalogued, with the transactional
  side seeded empty, so the suite creates and deletes without churning the demo dataset. Point a run
  elsewhere with `E2E_EMAIL`/`E2E_PASSWORD` rather than editing specs, and never let a spec assume which
  tenant it landed in — resolve every dependency from live data.
- **Every value a spec types lives in `e2e/test-data.ts`**, not in the specs, with `e2e/test-data.md`
  documenting each one plus alternative fictitious values to swap in.
- **One login per run.** `/auth/login/` is throttled, so an `auth.setup.ts` signs in once and every spec
  inherits the session via `storageState`. Only the login spec opts out — it tests login itself.
- **The backend throttles authenticated traffic per user** (`DEFAULT_THROTTLE_RATES` in
  `backend/proyecto3/settings.py`). A full run plus the app's own wide-list/fan-out queries eats a real
  share of that, so **back-to-back runs will start failing with 429s** that look like missing data. Leave a
  gap between runs; don't chase the "element not found" errors that follow.
- Locators match **Spanish UI text**, so pin the language in `localStorage` rather than trusting
  `DEFAULT_LANGUAGE`. Labels come from `src/shared/i18n/locales/es/*.json` — that's the place to look when a
  locator stops matching.
- **To watch a spec run instead of racing headlessly**, wire an `E2E_SLOWMO` (ms) env var into `slowMo` in
  [playwright.config.ts](playwright.config.ts), and extend the per-test timeout while it is set so
  slow-motion runs don't self-trigger.

---

## Architecture

Each feature lives in `src/modules/<context>/` and mirrors the backend's DDD layering (`domain/`,
`application/`, `infrastructure/`, `presentation/`). Each layer:

- `domain/entities/` — the frontend-owned entity (camelCase, e.g. `Customer.isActive`/`createdAt`), **never**
  the raw generated API DTO. `domain/services/` — pure functions: a `to<Entity>(dto)` mapper (the
  anti-corruption boundary) plus business logic (stats, filtering). No side effects, no React.
- `application/usecases/` — the use-case hooks (`use<Resource>`, `use<Resource>Mutations`);
  `application/dtos/` — input DTOs (`New<Resource>Input`). The `application/index.ts` barrel re-exports from
  `./usecases` + `./dtos`.
- `infrastructure/api/` — where **every write** lives; write operations return domain entities and
  `infrastructure/index.ts` re-exports them. It owns the generated SDK (`shared/types/sdk.gen`) with one
  deliberate exception: a **wide-list query hook may import the SDK directly** so its paginating `queryFn`
  can live next to the `queryKey` it belongs to (see the `fetchAllPages` rule below). Don't "fix" those
  imports back into `infrastructure/`.
- `presentation/` — `components/` (page + modals), `hooks/`, `stores/` (Zustand). Components consume domain
  entities + services only; no business logic inline.

`dashboard` is the **app shell**, not a data feature — it owns the layout (`DashboardLayout`, `AppHeader`,
`AppSidebar`), `HomePage`/`ComingSoonPage`, the `navigation.ts` route registry, and the `uiStore` (Zustand).

### Module status index

Every module has folders for all four layers; **the depth varies — don't assume a module is functional just
because its folder exists.** → **[modules.md](modules.md) has the per-module detail; read the section for the
module you're touching.**

| Status | Modules |
| ------ | ------- |
| **Scaffolded, empty** | `auth`, `dashboard` |
| **Canonical — copy these** | *(none yet — copy `auth`, `customers`, `locations` from `../../Logistics/frontend/src/modules/`)* |

The first two modules to make real are `auth` (store + Axios refresh interceptor — nothing else can call the
API until it exists) and `dashboard` (the shell + `navigation.ts` + `PAGE_HEADERS`). The first data module
you wire becomes this repo's canonical CRUD reference; record that in [modules.md](modules.md) when it lands.

---

## Data-access pattern

- Queries (`application/usecases/use<Resource>.ts`): take the `queryKey` from
  `companies<Resource>ListOptions(...)` (`shared/types/@tanstack/react-query.gen`), pair it with a
  `fetchAllPages` `queryFn`, and map to domain entities with a module-scope `select`
  (`data.results.map(to<Entity>)`). The tenant id (`company_pk`) comes from
  `useAuthStore((s) => s.user?.companyId)`; gate with `enabled: Boolean(companyId)`.
- **A wide list is never one page.** `query: { limit: 500 }` is not "the whole table" — it's *the newest
  500 rows* (every list orders `-created_at`, and the backend caps `max_limit` at 500). Nothing surfaces the
  truncation: the rows just stop existing as far as the UI is concerned, which reads as a broken join
  ("Cliente no disponible"), an under-counted delete-impact summary, or a task missing from a user's
  checklist. **Every company-wide/wide-scope list hook goes through `fetchAllPages`
  (`shared/lib/fetchAllPages.ts`)** — it reads `count` off page one and fetches the rest in parallel. Keep
  reusing the generated `...ListOptions()` **`queryKey`** so existing invalidation keeps matching.
  **When several hooks share one `queryKey`, the `queryFn` must return the DTO page shape**
  (`{ count, next: null, previous: null, results }`), not mapped entities — they share one cache entry and
  each applies its own `select`. Returning entities from one of them hands the others a value their selector
  can't read.
- **Two query shapes per resource — pick deliberately.** The **wide list** (`query: { limit: 500 }` +
  `fetchAllPages`) feeds company-wide aggregates, dropdown options and cross-module lookups, and is
  **filtered / aggregated in `domain/services`**. The **server-paginated** variant (`use<Resource>Page`)
  backs the interactive table: it passes `limit`/`offset` + a server-side search filter, returns
  `{ <entities>, total }` where `total` is the backend's `count` — **never the page array's length** — and
  sets `placeholderData: keepPreviousData` so paging doesn't flash empty. Don't slice a wide list
  client-side for a table that has a paginated hook.
- Mutations: the hook calls a write fn in `infrastructure/api` (which wraps the SDK with `throwOnError: true`
  and maps the result), then invalidates by query-key prefix
  (`queryClient.invalidateQueries({ queryKey: [{ _id: "companiesCustomersList" }], exact: false })`).
  The generated keys are **object-shaped** `[{ _id: "..." }]`, not plain strings.
- Parallel sub-resource queries: use `useQueries` + `combine`. Two variants:
  - **Map-returning** (count lookups): fire one cached query per entity UUID, combine into a
    `Map<uuid, result>`.
  - **Flat-list fan-out** (no company-wide endpoint): fire one query per entity UUID, flatten `data ?? []`
    arrays into one list. Multiple hooks sharing the same query options object share the same cache entry
    (no extra network requests).

---

## Shared layer (`src/shared/`)

`components/` holds reusable UI primitives — **prefer these over re-implementing.** The set to port over from
`../../Logistics/frontend/src/shared/components/` as you need them, and the reason each one is shared rather
than per-module:

- `Modal`, `Drawer` — standard overlay wrappers.
- `StatCard`, `ImpactStat` — metric display; `ImpactStat` is specifically for delete-confirmation cascade
  summaries (red destructive tone).
- `Pill`, `Toggle`, `EmptyState`, `Avatar`, `Skeleton` — general UI primitives.
- `ConfirmDialog` — destructive-action confirmation; `NotFoundPage` — the router's 404 component.
- `Pagination` — page controls shared by all list pages.
- `SortHeader` — the sortable table column header (label + directional caret), generic over the column
  union (`<SortHeader<"name" | "nit">>`). Every sortable table uses it; don't re-declare one locally.
- `RowMenu` — the per-row actions menu every list shares. `RowMenuRoot` wraps the row itself (the `<tr>`,
  or a card `<div>`) so a **right-click anywhere on the row opens the same items** the trailing
  `RowMenuTrigger` ("...") button does: items are declared **once** per module with
  `RowMenuItem`/`RowMenuSeparator`, which resolve to whichever Radix menu they land in
  (`DropdownMenu` vs `ContextMenu` — their component scopes are separate, so one can't be nested in the
  other). The module's own `*RowMenu` owns the state its items drive (confirm/edit modals, passed as
  `dialogs`), so there is exactly one instance of each dialog per row regardless of which menu opened it.
  A row that offers no actions (no permission, or a locked row like the signed-in user's own) returns
  `children` bare instead of wrapping: `RowMenuTrigger` then renders nothing and the browser's native
  context menu still works. Don't hand-roll a `DropdownMenu` in a new list.
- `RouteErrorPage` — the router's `errorComponent`/`defaultErrorComponent`. Without it a throw during
  render unmounts the whole tree and the app goes blank. `AppErrorBoundary` is the outer net for throws
  above/outside the router; both render the shared `ErrorScreen` layout (see "Logging and crash handling").
- `SegmentedTabs` — underline-style tab bar used when a page hosts sibling panels. Controlled: parent owns
  the active tab id.
- `CatalogCard` — standardized catalog item card. Renders as `<button>` when `onClick` is provided (shows
  `ChevronRight`), `<div>` otherwise.
- `RequiredMark` — asterisk for required form fields.
- `SectionFieldBuilder` — **the** section/field builder, shared by every form-builder modal. Owns
  drag-to-reorder (`@dnd-kit`), the custom-field picker/search, and per-field required/photo toggles.
  Adding a builder means composing this, never re-implementing a sortable list.
- `DateTimeFieldInput` — splits a `datetime-local` value into a date input plus a collapsed, opt-in
  ("Agregar hora") time input, while keeping the value one combined `"YYYY-MM-DDTHH:MM"` string so callers'
  parsing is unchanged. Pass Shadcn's `Input` via the `Input` prop inside a Shadcn form.
- `CopyButton`, `EmptyOptionsHint` — copy-to-clipboard affordance; empty-state hint for option lists.

`hooks/` holds cross-module hooks (`useDebouncedValue`); `types/` is the generated SDK (never edit). Shadcn
primitives live separately in `src/shadcn/components/ui/`. `lib/` holds helpers:

- `apiError.ts` — `getApiErrorMessage`, mandatory for every caught error (see below).
- `date.ts` — **the only place a backend date string is parsed or formatted.** `parseBackendDate` handles
  the date-only (`YYYY-MM-DD`, Django `DateField`) case a bare `new Date()` gets wrong — it parses as UTC
  midnight, which renders as the *previous* day in Bogotá (UTC-5). Use the ready-made formatters
  (`formatLongDate` for drawers, `formatShortDate` for tables, `formatDayMonth`, `formatLongDateTime`,
  `formatShortDateTime`); they're null-safe and render `EMPTY_DATE_LABEL` ("—") for missing/invalid input.
  **Never declare a local `Intl.DateTimeFormat` + `formatDate` pair in a component** — that duplication is
  exactly how the UTC-shift bug spreads.
- `fetchAllPages.ts` — pages a DRF list endpoint to exhaustion; mandatory for wide lists (see above).
- `search.ts` — `normalizeSearchTerm`, case- **and accent**-insensitive matching ("bogota" matches "Bogotá").
  Apply to both the term and each searchable field; don't hand-roll `toLowerCase()` comparisons.
- `formLimits.ts` — `TEXT_FIELD_MAX_LENGTH` (65) and `PHONE_FIELD_MAX_LENGTH` (30). **Every single-line
  free-text box carries one of these as `maxLength`** — names, codes, versions, identifiers, addresses,
  search/filter boxes — and the field's Zod schema mirrors it. A field with a stricter rule of its own keeps
  it. Per-module `*_NAME_MAX_LENGTH` constants are aliases of `TEXT_FIELD_MAX_LENGTH`, so the ceiling moves
  in one place. **Exempt by design — do not add a `maxLength` or a schema `.max()` to these:**
  **descripción / notas / observaciones boxes** (every `<textarea>` in the app plus single-line
  "Descripción" inputs) are the one place a user writes as much as the situation needs; non-text controls
  (`number`, `date`, `datetime-local`, `file`, `checkbox`); and **password fields**, where a cap would lock
  out an already-set credential.
- `logger.ts` — the **only** place `console` may be called; everything else logs through it (see "Logging
  and crash handling"). `globalErrorHandlers.ts` — `installGlobalErrorHandlers()`, called once in
  `src/index.tsx`, for the errors no React boundary can see.
- `initials.ts`, `formClasses.ts` (shared input/label class strings), `uid.ts` (`crypto.randomUUID` for
  form-builder list items that don't exist on the backend yet).

**Forms:** `react-hook-form` + `zod` schemas via `@hookform/resolvers`, rendered with the Shadcn `form`
primitives.

---

## Error messages — NEVER write generic UI error strings. Ever. No exceptions.

> ❌ `"Ocurrió un error inesperado. Vuelve a intentarlo."`
> ❌ `"No se pudo completar la acción."`
> ❌ `"Verifica los datos e inténtalo de nuevo."`
>
> These phrases are **banned**. If you write one, you have failed the user: they don't know what happened,
> whether it's their fault, or whether retrying will help.

Every caught error **must** go through `getApiErrorMessage(error, { action })` from
`src/shared/lib/apiError.ts` before surfacing in a toast or form banner. It maps:

- `DomainError` (`{ code, custom_msg, ... }` — note: key is `custom_msg`, NOT `message`) → the backend's
  specific message
- DRF field validation errors (`{ field_name: ["msg"] }`) → the first field error
- DRF built-ins (`{ detail }`) → the detail string
- **403** → `"No tienes permiso para {action}."` (always pass `action` as an infinitive phrase, e.g.
  `"eliminar el cliente"`)
- No response (server down, offline) → `"No se pudo conectar con el servidor…"`
- **500/502** (a fault waiting won't clear) → `"No se pudo {action}: el servidor tuvo un problema…"`, which
  also rules out the user's data as the cause — deliberately **without** "try again in a few minutes", so the
  user isn't sent into a retry loop over something a retry can't fix
- **503/504** (busy / timed out, where waiting really is the fix) → `"No se pudo {action}: el servidor no
  está disponible en este momento. Inténtalo de nuevo en unos minutos."`

Both 5xx branches `logger.error` the backend's developer-facing body (`{ code, message }`) with the method
and URL. It stays out of the UI, but it is **not** swallowed: on a 5xx the browser holds the only copy of the
cause anyone can reach, and dropping it leaves "el servidor tuvo un problema" as the sole evidence — the
console line is what turns that into a one-glance answer.

Rules for every mutation:

1. **Toasts** (`onError` in `useMutation`): always `toast.error(getApiErrorMessage(error, { action: "..." }))`.
2. **Form banners** (`isError` in a modal): always `getApiErrorMessage(error, { action: "..." })`.
3. **Never** hardcode a string in an `onError` handler or catch block — if you know the specific error shape
   (e.g. 409 duplicate), handle it as a special case **before** falling back to `getApiErrorMessage`.

---

## Logging and crash handling

**Never call `console.*` in application code — `no-console` is an ESLint error.** Log through
`logger` (`src/shared/lib/logger.ts`), which is the single seam where an error tracker (Sentry/Datadog)
gets wired in later without touching every `catch` in the codebase. The only exemptions are `logger.ts`
itself (file-level disable) and `e2e/` (its terminal output *is* its UI).

- `logger.debug` / `logger.info` — development aids; `import.meta.env.PROD` is a build-time constant, so
  these calls are **removed from the production bundle** entirely.
- `logger.warn` — something degraded but the app carried on (a best-effort call failed).
- `logger.error` — something broke. Always logged, in every environment.

Tag every message with its subsystem (`[api]`, `[auth]`, `[i18n]`, `[react]`, `[window]`) and pass the
error object as a trailing argument instead of interpolating it — devtools renders an object with its
stack, a template literal renders `[object Object]`.

Three layers catch what would otherwise be a white page, and they don't overlap:

1. **`RouteErrorPage`** (router `errorComponent`) — a throw inside one route. The rest of the app survives,
   so it offers a retry.
2. **`AppErrorBoundary`** (`src/index.tsx`, wrapped around everything) — a throw *above or outside* the
   router: a provider, the router config, `RouterProvider` itself. Nothing else catches these, and React's
   rule is that an uncaught render error unmounts the whole tree. It offers a reload, not a retry, and uses
   no router API (a `<Link>` outside `RouterProvider` throws). Both screens share the `ErrorScreen` layout.
3. **`installGlobalErrorHandlers`** (`shared/lib/globalErrorHandlers.ts`) — the failures **no** React
   boundary can see: throws in event handlers and timers, and unhandled promise rejections.

Boundaries **don't log**. `onCaughtError`/`onUncaughtError` on the React root (`src/index.tsx`) report
every boundary catch — including the router's — from one place, with the `componentStack`, so a boundary
added later can't be the one that forgot.

---

## Permission gating (UI layer)

Disable/hide controls the signed-in role can't use so the user never clicks into a guaranteed 403 — this is
defense-in-depth *paired* with the error message above, **not a replacement** (the backend is the real gate).

Read permissions with `useHasPermission()` (`auth/presentation/hooks`), which checks the short Django
codenames the JWT carries (`add_customer`/`change_customer`/`deactivate_customer`/…, mirroring each action's
`CorePermission` in the backend ViewSet; superadmins bypass). Compute `can*` flags once in the page container
and thread booleans to leaf components; **disable with a `title` tooltip** (`"No tienes permiso para …"`)
rather than silently hiding, except drop a control entirely when it would otherwise be an all-disabled menu.

Codenames live in the module's `domain/constants` (e.g. `CUSTOMER_PERMISSIONS`). Note that a UI "Eliminar"
that is really a **soft-delete** gates on `deactivate_<model>`, not `delete_<model>`.

---

## Routing

**TanStack Router** with flat file-based routes in `src/routes/` — one file per page, plus `__root.tsx`,
`index.tsx`, and the auth/standalone pages (`login.tsx`, `profile.tsx`, `set-password.tsx`, `welcome.tsx`).
The router plugin auto-generates `src/routeTree.gen.ts` — **do not edit it manually.**

**A route filename need not match the module or backend name** — each route file just imports the page
component, so follow the import to find the module. When they diverge, record the mapping in a table in
[modules.md](modules.md) so the next person doesn't have to grep for it.

Sidebar links are permission-filtered via the `permissions` field on each entry in `dashboard`'s
`navigation.ts` registry, which also owns the `PAGE_HEADERS` title/subtitle map — **add both when you add a
page.** A role-restricted page gets a `beforeLoad` redirect on its route.

**TanStack file-based routing convention:** a `_` suffix on a path segment (e.g.
`locations_.$locationId.tsx`) means the route does **not** inherit the parent segment's layout — it renders
as a standalone page rather than nested inside the list layout.

**Path param vs. query param for a single resource's uuid — pick by UI shape, not by habit.** Use a **query
param** (`?resource=<uuid>`, via `validateSearch`) when the id only opens a detail drawer/modal **on top of
an existing list route** — the route itself doesn't change, the id just toggles overlay state; this is the
common case. Use a **path param** (`/resource/:id`, own route file) only when the id identifies a genuinely
standalone page with its own layout/nested content. This is a UI-shape decision, **not a security one**: a
UUID is an identifier, not a secret, and IDOR protection comes entirely from server-side tenant/permission
checks on every request, not from where the id sits in the URL.

---

## Language and casing

**Titles and subtitles: Sentence case, not Title Case.** Every UI title/subtitle/heading (page headers,
`PAGE_HEADERS`, sidebar `NAV_ITEMS` labels, section headings, modal/drawer titles) is written in Sentence
case (estilo oracional del español) — capitalize only the first letter of the first word. Proper nouns keep
their own capitalization (e.g. "Gestiion", "Gmail", a company's name). Wrong: "Tipos de Equipos", "Órdenes de
Trabajo". Right: "Tipos de equipos", "Órdenes de trabajo".

**Code is English, the product is Spanish — and the line falls in a specific place.** Identifiers, filenames,
routes, types and comments are **English** (`FindingsTab`, `/my-workday`, `useFindingForm`). **Not** renamed
to English, deliberately: (a) UI-facing strings, which stay Spanish, and (b) **any string value the backend
persists or keys on** — enum values, custom-field `key`s, reserved names. Renaming a persisted value is a
data migration, not a rename, and would orphan existing rows. When touching a Spanish-named symbol, rename
the identifier and leave its value alone.

---

## Auth

State lives in `src/modules/auth/presentation/stores/authStore.ts` (Zustand + persisted JWT). The Axios
interceptor in `src/modules/auth/infrastructure/api/index.ts` handles silent token refresh with
single-flight deduplication; **`configureAuthClient()` must be called once before the app renders.**

The login/logout flow shows a full-screen branded overlay driven by `authTransitionStore` (a transient
Zustand store, deliberately separate from `uiStore`); the `AuthTransitionOverlay` component lives in
`shared/components` and is rendered once in `__root.tsx` so it survives the DashboardLayout ↔ login-page swap.

Invited users get **no temporary password**: the invite email carries a set-password link handled by
`/set-password?uid=…&token=…` (wraps `auth/password/reset/confirm/`), after which `/welcome` shows a one-time
mini-onboarding gated by a device-local `welcomeStore` marker.

---

## Build note

The React Compiler (`babel-plugin-react-compiler`) is enabled, so **avoid manual `useMemo`/`useCallback`
micro-optimizations** unless profiling shows a need.
