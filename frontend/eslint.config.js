// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import js from "@eslint/js";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([globalIgnores(["dist"]), {
    ignores: ["src/shared/types/schema.ts", "src/shared/types/**/*"],
    files: ["**/*.{ts,tsx}"],
    extends: [
        js.configs.recommended,
        tseslint.configs.strictTypeChecked,
        tseslint.configs.stylisticTypeChecked,
        reactHooks.configs.flat.recommended,
        reactRefresh.configs.vite,
        jsxA11y.flatConfigs.recommended,
    ],
    languageOptions: {
        ecmaVersion: 2020,
        globals: globals.browser,
        parserOptions: {
            project: ["./tsconfig.node.json", "./tsconfig.app.json"],
            tsconfigRootDir: import.meta.dirname,
        },
    },
    rules: {
        // Application code logs through `shared/lib/logger`, never `console`
        // directly — that module is the single seam where an error tracker gets
        // wired in later, and the only place `debug`/`info` are guaranteed to
        // compile out of a production build. The rule is banned outright rather
        // than merely allowing `warn`/`error`, because "allowed" is how the seam
        // rots: every new direct call is one more place to edit later.
        // `logger.ts` itself carries a file-level disable, and `e2e/` is exempt
        // below.
        "no-console": "error",
    },
}, {
    // a11y rules govern real UI markup; test files render mock DOM
    // structures that don't ship, so the rules are just noise there.
    files: ["**/*.test.{ts,tsx}"],
    rules: Object.fromEntries(
        Object.keys(jsxA11y.flatConfigs.recommended.rules).map((rule) => [rule, "off"])
    ),
}, {
    // Playwright specs contain no React at all. The hooks rule still fires on
    // them because Playwright's fixture API hands the callback a parameter
    // named `use`, which the rule reads as a hook call in a non-component
    // function — a false positive with no way to satisfy it but renaming
    // Playwright's own API.
    files: ["e2e/**/*.ts"],
    rules: {
        "react-hooks/rules-of-hooks": "off",
        // The Playwright suite's console output IS its user interface: the
        // teardown sweep reports what it deleted to the terminal running it.
        // There's no browser console and no error tracker involved.
        "no-console": "off",
    },
}, ...storybook.configs["flat/recommended"]]);
