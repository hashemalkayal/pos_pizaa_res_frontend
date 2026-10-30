import { setupServer } from "msw/node";
import { handlers } from "@/mocks/handlers";

/** MSW for Vitest (Node). Tests add per-case overrides with `server.use(...)`. */
export const server = setupServer(...handlers);
