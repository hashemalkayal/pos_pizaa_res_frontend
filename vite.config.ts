import type { Plugin } from "vite";
import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";
import Checker from "vite-plugin-checker";

const require = createRequire(import.meta.url);

/**
 * Serves MSW's worker script from node_modules in the dev server only, so mock infrastructure is never
 * copied into a production build (mocks run only with `yarn dev:mock`).
 */
const mswWorkerForDevServer = (): Plugin => ({
  name: "msw-worker-dev-server",
  apply: "serve",
  configureServer(server) {
    server.middlewares.use("/mockServiceWorker.js", (_req, res) => {
      res.setHeader("Content-Type", "text/javascript");
      res.end(fs.readFileSync(require.resolve("msw/mockServiceWorker.js")));
    });
  },
});

export default defineConfig({
  plugins: [react(), mswWorkerForDevServer(), Checker({ typescript: false })],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    // Live contract tests need the real local backend: `yarn test:live` (vitest.live.config.ts).
    exclude: [...configDefaults.exclude, "**/*.live.test.ts"],
    env: { VITE_PUBLIC_API_URL: "http://localhost:3000/api" },
    restoreMocks: true,
  },
});
