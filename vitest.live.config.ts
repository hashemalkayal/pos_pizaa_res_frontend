import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * `yarn test:live`: src/**\/*.live.test.ts against the local DEV backend (D:\Backend\pos, `pnpm dev`,
 * database pos). Node environment: no jsdom and no MSW server. Not part of `yarn test`.
 *   LIVE_API_URL   default http://localhost:8080/api (the tests refuse any non-local host)
 *   LIVE_EMAIL / LIVE_PASSWORD   a DEV account (backend docs/dev-setup.md)
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.live.test.ts"],
    env: {
      VITE_PUBLIC_API_URL: process.env.LIVE_API_URL ?? "http://localhost:8080/api",
      LIVE_EMAIL: process.env.LIVE_EMAIL ?? "",
      LIVE_PASSWORD: process.env.LIVE_PASSWORD ?? "",
    },
    testTimeout: 20_000,
  },
});
