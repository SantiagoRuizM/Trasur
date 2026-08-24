import { defineConfig, devices } from "@playwright/test";

import { ADMIN_STATE_FILE, TECHNICIAN_STATE_FILE } from "./e2e/helpers";

/**
 * Milliseconds paused between browser actions — the knob for *watching* a spec
 * instead of gating a push on it. Playwright has no `--slow-mo` CLI flag, so it
 * is read from the environment and stays strictly per-run: the pre-push gate
 * keeps running at full speed, and only the run you set the variable for slows
 * down. 300–800ms is the readable range.
 *
 *   PowerShell:  $env:E2E_SLOWMO=500; npm run test:e2e -- e2e/customers.spec.ts
 *                $env:E2E_SLOWMO=$null   ← clear it; a PowerShell variable
 *                                          outlives the command, so every later
 *                                          run in that terminal stays slow
 *   Git Bash:    E2E_SLOWMO=500 npm run test:e2e -- e2e/customers.spec.ts
 *
 * Unset — or non-numeric — reads as 0, which is exactly the behaviour this
 * config had before the variable existed.
 */
const slowMo = Number(process.env.E2E_SLOWMO) || 0;
const watching = slowMo > 0;

/**
 * Live end-to-end coverage of the app's CRUD surface: one spec per entity,
 * each creating → reading → updating → deleting a real record through the real
 * UI against the real backend.
 *
 * Runs against an already-running dev server + backend (see frontend/CLAUDE.md
 * — never start a second dev server; this reuses whatever's on :5173). This is
 * the gate to run before pushing.
 */
export default defineConfig({
    testDir: "./e2e",
    fullyParallel: false,
    // Serial, single worker — 3 parallel Chromium instances against a
    // sandboxed dev machine caused resource-contention flakiness (tests that
    // pass in isolation timing out waiting on basic locators under load).
    // It is also what keeps the shared dev database predictable: these specs
    // write real rows, so concurrent runs would race each other's lists.
    workers: 1,
    // A CRUD spec is dozens of actions, so even a modest slowMo outruns the 60s
    // budget on its own — the timeout scales with the mode rather than failing
    // the very run you slowed down in order to watch it.
    timeout: watching ? 5 * 60_000 : 60_000,
    retries: 0,
    reporter: "list",
    use: {
        baseURL: "http://localhost:5173",
        trace: "retain-on-failure",
        // Setting the variable is the whole gesture: slowing down a browser
        // nobody can see would just burn minutes, so watching implies headed.
        // Left `undefined` otherwise, so a plain `--headed` still works on its
        // own (CLI flags override this either way).
        headless: watching ? false : undefined,
        launchOptions: { slowMo },
    },
    /**
     * `reuseExistingServer` is the important half: the repo rule is to never
     * start a second dev server (Vite silently drifts to 5174/5175 instead of
     * erroring), so this attaches to whatever is already on 5173 and only
     * spawns one when nothing is. Previously the config had no `webServer` at
     * all, so running the suite with the dev server down failed as a wall of
     * locator timeouts that never mentioned the actual cause.
     *
     * The backend still has to be up separately — these specs read and write
     * real seed data, and Playwright can't health-check that from here.
     */
    webServer: {
        command: "npm run dev",
        url: "http://localhost:5173",
        reuseExistingServer: true,
        timeout: 120_000,
    },
    projects: [
        /**
         * Logs in once and saves the session. Every spec below depends on it,
         * because `/auth/login/` is throttled and a per-spec login across this
         * many files trips the throttle mid-run.
         *
         * The sweep hangs off this project's `teardown`, not off a
         * `dependencies: ["chromium"]` on the sweep itself. That distinction is
         * the whole point: a project whose dependency *failed* is skipped, so
         * wiring it as a dependent meant the cleanup ran on green runs and was
         * silently skipped on red ones — exactly backwards, since a red run is
         * the one that leaves records behind. As a `teardown` it runs after
         * setup and everything depending on setup has finished, pass or fail.
         */
        { name: "setup", testMatch: /auth\.setup\.ts/, teardown: "teardown" },
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"], storageState: ADMIN_STATE_FILE },
            dependencies: ["setup"],
            testIgnore: /(auth\.setup|tecnico\.setup|global\.teardown|workday-findings\.spec)\.ts/,
        },
        /**
         * Signs in as the seed **técnico**. Separate from `setup` on purpose:
         * a tenant without a técnico login should lose only the workday spec,
         * not the entire suite, and a project whose dependency failed is
         * skipped rather than failed.
         */
        { name: "tecnico-setup", testMatch: /tecnico\.setup\.ts/, teardown: "teardown" },
        /**
         * The one spec that must run as a técnico. `/my-workday` is the only
         * role-gated route in the app (`beforeLoad` bounces administrative
         * users to `/`), so the finding-reporting flow is unreachable from the
         * admin session every other project uses.
         *
         * It depends **only** on its own setup, deliberately. Making it depend
         * on `chromium` too (for ordering against the shared dev database)
         * meant `npm run test:e2e -- e2e/workday-findings.spec.ts` quietly
         * pulled the entire admin suite in as a prerequisite — which on a
         * backend throttled at `1000/hour` per user is the difference between
         * one spec and a burnt hour. `workers: 1` already serialises every
         * test in the run regardless of project, so the ordering that
         * dependency bought was never load-bearing.
         */
        {
            name: "tecnico",
            use: { ...devices["Desktop Chrome"], storageState: TECHNICIAN_STATE_FILE },
            dependencies: ["tecnico-setup"],
            testMatch: /workday-findings\.spec\.ts/,
        },
        /** Deactivates anything the run left behind in the shared dev database. */
        { name: "teardown", testMatch: /global\.teardown\.ts/ },
    ],
});
