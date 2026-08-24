import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { URL, fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { visualizer } from "rollup-plugin-visualizer";

// https://vite.dev/config/
export default defineConfig({
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
        },
    },
    build: {
        rollupOptions: {
            output: {
                // `shared/i18n` lazy-globs `locales/<lang>/<ns>.json`, which
                // would otherwise emit one ~5 kB chunk per namespace — 25
                // separate requests to show a single language. Grouping by
                // language gives one request instead, and lets the namespaces
                // share a compression dictionary.
                manualChunks(id) {
                    const locale = /[\\/]locales[\\/]([^\\/]+)[\\/][^\\/]+\.json$/.exec(id);
                    return locale ? `locale-${locale[1]}` : null;
                },
            },
        },
    },
    plugins: [
        // Please make sure that '@tanstack/router-plugin' is passed before '@vitejs/plugin-react'
        tanstackRouter({
            target: "react",
            autoCodeSplitting: true,
        }),
        react(),
        babel({ presets: [reactCompilerPreset()] }),
        tailwindcss(),
        // Emits dist/stats.html on every build — a treemap of what's actually
        // in the bundle. `npm run analyze` builds and opens it; it's cheap to
        // regenerate (no dev-server cost) so it's left on for every build.
        visualizer({
            filename: "dist/stats.html",
            gzipSize: true,
            brotliSize: true,
            template: "treemap",
        }),
    ],
});
