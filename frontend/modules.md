# Frontend modules — wiring status and per-module notes

Companion to [CLAUDE.md](CLAUDE.md). That file has the architecture, the layer contract and the
cross-cutting rules; **this file has the per-module detail** — read the section for the module you're
touching before you change it.

Every module has folders for all four layers; **the depth varies — don't assume a module is functional
just because its folder exists.** The status table in [CLAUDE.md](CLAUDE.md) is the index; the sections
below are the detail behind it.

> **Bootstrap status.** Proyecto3 has no wired modules yet — only the `auth` and `dashboard` folder
> skeletons. Everything below is the *contract* for what a section must contain once a module exists, plus
> the archetype catalogue to copy from `../../Logistics/frontend/src/modules/`. Fill this file in as you go;
> a module without a section here is a module the next person has to reverse-engineer.

---

## Status

| Module | Route(s) | Status | Notes |
| ------ | -------- | ------ | ----- |
| `auth` | `/login`, `/set-password`, `/welcome` | **scaffolded, empty** | Build first — nothing can call the API until the store + refresh interceptor exist. |
| `dashboard` | `/` (shell) | **scaffolded, empty** | The app shell: `DashboardLayout`, `AppHeader`, `AppSidebar`, `navigation.ts`, `PAGE_HEADERS`, `uiStore`. Not a data feature. |

Add a row per module as you wire it, and a `###` section below with the detail.

---

## Archetypes to copy (from `../../Logistics/frontend/src/modules/`)

Pick the closest shape before writing anything — the point is that a reader who knows one module already
knows the next.

| Archetype | Reference module | Shape |
| --------- | ---------------- | ----- |
| CRUD table + bulk-bar + row-menu + detail-drawer | `customers` (canonical), `users` | The default for a list page. Also the reference for modal/mutation error handling and permission gating. |
| Standalone detail route with its own layout | `locations` (`locations_.$locationId.tsx`) | Use only when the id identifies a genuinely standalone page, not a drawer over a list. |
| Card-grid catalog | `systemTypes`, `systems` | 9/24/48 page sizes over the shared `CatalogCard`. |
| Multi-POST builder (form → sections → fields) | `forms`, `registrationForms` | Composes the shared `SectionFieldBuilder`; no transactional endpoint, so the modal drives several POSTs in order and has to be resumable. |
| Permissions matrix / rich domain layer | `roles` | The densest `domain/services` layer — read it before inventing your own matrix. |
| Read-only reference library (no writes) | `norms` | No `infrastructure/api` write functions at all. |
| Multi-route feature (list + detail + specialized flows) | `planning` | Several pages of one module sharing a domain layer. |
| Auth (stores, refresh interceptor, permission hooks) | `auth` | Copy wholesale — this one is infrastructure, not a feature. |

---

## What a module section must document

When you wire a module, add a `### \`<module>\`` section here covering:

1. **Route(s)** and the route-file names, especially if they don't match the module name (they often don't —
   record the mapping so nobody has to grep for it).
2. **Archetype mirrored** and any deliberate deviation from it, with the reason.
3. **List shapes in use** — wide (`fetchAllPages`), server-paginated (`use<Resource>Page`), or both — and
   which hooks share a `queryKey` (those must return the DTO page shape, not entities).
4. **Backend endpoints consumed**, and any gap the UI works around.
5. **Permission codenames** the module gates on, and where they live in `domain/constants`.
6. **Quirks** — anything that surprised you and would surprise the next reader. This is the highest-value
   part of the section; a module with no quirks section is usually a module nobody has debugged yet.

---

## Cross-module conventions worth repeating

- **Wide list ≠ one page.** `limit: 500` is the newest 500 rows, not the table. Every company-wide list goes
  through `fetchAllPages`. → [CLAUDE.md](CLAUDE.md#data-access-pattern)
- **Reuse the generated `queryKey`** from `...ListOptions()` so invalidation keeps matching.
- **Every caught error** goes through `getApiErrorMessage(error, { action })`. No generic strings, ever.
- **Sentence case** for every UI title and subtitle.
- **`navigation.ts` + `PAGE_HEADERS`** both get an entry when you add a page — a page in one but not the
  other renders headerless or unreachable.
