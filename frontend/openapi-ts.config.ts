import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
    input: "http://localhost:8000/api/v1/schema/",
    output: {
        path: "src/shared/types",
        format: "prettier", // Aplica tu .prettierrc.json automáticamente
    },
    plugins: [
        // 1. Genera las interfaces base
        {
            name: "@hey-api/typescript",
            // TODO: We need to check what we need to do to enable typescript instead of javascript
            // enums: "typescript", // Importante para coherencia con modelos Python
            enums: "javascript", // También genera enums en JavaScript para uso directo si lo deseas
        },
        // 2. Configura el cliente Axios que ya tienes en package.json
        "@hey-api/client-axios",
        // 3. Genera las funciones del SDK (sustituye 'asynchronous: true')
        "@hey-api/sdk",
        // 4. GENERACIÓN DE HOOKS (Opcional pero recomendado para TanStack Query)
        // Esto te dará useQuery() y useMutation() tipados automáticamente
        {
            name: "@tanstack/react-query",
        },
    ],
});
