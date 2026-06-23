import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      // In dev, import @ticketly/shared from its TypeScript *source*, not the
      // built `shared/dist`. The dist is CommonJS, and Vite serves it raw via
      // /@fs/ (it only runs CJS→ESM interop during dependency pre-bundling) — so
      // the first runtime value import of a shared Zod schema (createUserSchema)
      // failed with "does not provide an export named". The source is ESM, so it
      // is served with real `export` statements. The production build still
      // bundles the CJS dist (built by the root scripts), so this is dev-only.
      ...(command === "serve"
        ? { "@ticketly/shared": path.resolve(import.meta.dirname, "../shared/src/index.ts") }
        : {}),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Forward API + Better Auth calls + health to the NestJS backend during dev,
      // so cookies/sessions work without CORS.
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/health": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
}));
