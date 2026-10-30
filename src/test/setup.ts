import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import i18n from "@/i18n";
import { resetMockState } from "@/mocks/handlers";
import { server } from "./server";

// jsdom gaps that Mantine relies on.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
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
