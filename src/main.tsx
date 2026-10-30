import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/dates/styles.css";
import "./theme/global.css";
import "./i18n";
import { App } from "./app/App";

/**
 * Mocks start only in the dev server in mode "mock" with `.env.mock` (`yarn dev:mock`), never with
 * `yarn dev` or any other mode. The condition is static, so production builds drop the mock code entirely.
 */
const startMocking = async () => {
  if (import.meta.env.DEV && import.meta.env.MODE === "mock" && import.meta.env.VITE_API_MOCKING === "enabled") {
    const { worker } = await import("./mocks/browser");
    await worker.start({ onUnhandledRequest: "bypass", quiet: true });
  }
};

void startMocking().then(() => {
  const root = document.getElementById("root");
  if (!root) throw new Error("#root element not found");
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
});
