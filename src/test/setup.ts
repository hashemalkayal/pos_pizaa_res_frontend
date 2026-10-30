import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import i18n from "@/i18n";
import { resetMockState } from "@/mocks/handlers";
import { server } from "./server";

/** `(min-width: …)` / `(max-width: …)` against the window width (jsdom: 1024px); anything else does not match. */
const evaluateMediaQuery = (query: string) => {
  const conditions = [...query.matchAll(/\((min|max)-width:\s*([\d.]+)(px|em|rem)\)/g)];
  if (!conditions.length) return false;
  return conditions.every(([, kind, amount, unit]) => {
    const pixels = Number(amount) * (unit === "px" ? 1 : 16);
    return kind === "min" ? window.innerWidth >= pixels : window.innerWidth <= pixels;
  });
};

// jsdom gaps that Mantine relies on.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: evaluateMediaQuery(query),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
window.HTMLElement.prototype.scrollIntoView = () => {};

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

afterEach(async () => {
  cleanup();
  server.resetHandlers();
  resetMockState();
  window.localStorage.clear();
  await i18n.changeLanguage("en");
});

afterAll(() => server.close());
