# End-to-end suite (Playwright)

Live CRUD coverage: **one spec per entity**, each creating → reading → updating → deleting a real record
through the real UI, against the running backend and the real dev database. Nothing is mocked.

**Run it before every push.** CI ([../../.github/workflows/checks.yml](../../.github/workflows/checks.yml))
runs only prettier/lint/typecheck/build — neither Vitest nor Playwright runs there, so this suite only ever
runs if you run it.

> **Bootstrap status.** No specs exist yet. This file is the contract the first spec must satisfy; the
> working implementation to copy is `../../../Logistics/frontend/e2e/`.

```bash
cd frontend
npm run test:e2e                          # everything
npm run test:e2e -- e2e/<entity>.spec.ts  # one file
npm run test:e2e -- --ui                  # best way to debug
npm run test:e2e -- --headed              # watch the browser
npx playwright show-trace test-results/<…>/trace.zip   # autopsy of a failure
```

Naming one file still runs **every project that file could belong to**, plus each project's setup. That is
usually invisible, but it costs a login per setup — so when you mean one spec in one session, add
`--project=<name>`.

### Watching a spec in slow motion

`--headed` alone runs at machine speed — fine for confirming a flow exists, too fast to follow. Playwright
has no `--slow-mo` flag, so wire the pause between actions to an **`E2E_SLOWMO`** (milliseconds) env var read
in [../playwright.config.ts](../playwright.config.ts), and **extend the per-test timeout while it is set** so
a slow-motion run doesn't time itself out.

```bash
E2E_SLOWMO=500 npm run test:e2e -- e2e/<entity>.spec.ts     # Git Bash
$env:E2E_SLOWMO=500; npm run test:e2e -- e2e/<entity>.spec.ts   # PowerShell
```

---

## The rules a spec must follow

These are not style preferences — each one is a failure mode that already bit the `Logistics` suite.

1. **It writes to the shared dev database.** Prefix every record it creates with `E2E `, delete what it
   created (that *is* the D in CRUD), and let a `global.teardown.ts` sweep whatever a failed run left behind.
2. **Run against a dedicated tenant, not the showcase one.** Richly catalogued, transactional side seeded
   empty. `E2E_EMAIL`/`E2E_PASSWORD` repoint a run without editing a spec.
3. **No spec assumes which tenant it landed in.** Resolve every dependency (clients, sites, forms) from live
   data, never from a hardcoded uuid or name.
4. **Every value a spec types lives in `test-data.ts`**, not inline — with `test-data.md` documenting each
   one and carrying alternative fictitious values to swap in.
5. **One login per run.** The login endpoint is throttled (`5/minute`), so an `auth.setup.ts` signs in once
   and every spec inherits the session via `storageState`. Only the login spec opts out — it tests login.
6. **Mind the authenticated throttle.** The backend caps authenticated traffic per user
   (`DEFAULT_THROTTLE_RATES` in `backend/proyecto3/settings.py`). A full run plus the app's own wide-list
   fan-out queries eats a real share of it, so **back-to-back runs start failing with 429s that look like
   missing data**. Leave a gap between runs instead of chasing the "element not found" errors that follow.
7. **Locators match Spanish UI text**, so pin the language in `localStorage` rather than trusting
   `DEFAULT_LANGUAGE`. Labels come from `src/shared/i18n/locales/es/*.json` — check there first when a
   locator stops matching.
8. **`console` is allowed here** and nowhere else in the repo: the suite's terminal output *is* its UI.

## What this suite deliberately does not cover

Write this section for real once specs exist. Keeping the exclusions explicit is what stops someone from
"fixing" a gap that is actually a decision — and from assuming coverage that was never there.
