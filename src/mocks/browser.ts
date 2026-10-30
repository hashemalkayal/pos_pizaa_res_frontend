import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

/** DEVELOPMENT ONLY: started by main.tsx in `yarn dev:mock`; never part of a production build. */
export const worker = setupWorker(...handlers);
