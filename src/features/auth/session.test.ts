import { afterEach, describe, expect, it, vi } from "vitest";
import { buildMockToken } from "@/mocks/jwt";
import {
  SESSION_STORAGE_KEY,
  clearStoredSession,
  getAccessToken,
  isAdmin,
  isSessionExpired,
  readStoredSession,
  sessionFromToken,
  shownName,
  storeSession,
} from "./session";

const claims = { userId: 2, email: "cashier@mock.local", role: "CASHER" };

describe("session from the backend token", () => {
  it("reads userId, email, role and the 15-day expiry from the claims", () => {
    const { token, exp } = buildMockToken(claims, { issuedAt: 1_800_000_000 });
    const session = sessionFromToken(token);
    expect(session).toEqual({ accessToken: token, expiresAt: new Date(exp * 1000).toISOString(), user: { id: 2, email: "cashier@mock.local", role: "CASHER", displayName: null } });
    expect(exp - 1_800_000_000).toBe(15 * 24 * 60 * 60);
  });

  it("reads the optional display name; the shown name falls back to the email", () => {
    const named = sessionFromToken(buildMockToken({ ...claims, displayName: " Restaurant Cashier " }).token)!;
    expect(named.user.displayName).toBe("Restaurant Cashier");
    expect(shownName(named.user)).toBe("Restaurant Cashier");
    const unnamed = sessionFromToken(buildMockToken(claims).token)!;
    expect(shownName(unnamed.user)).toBe("cashier@mock.local");
  });

  it("stores the session under the unversioned key", () => {
    expect(SESSION_STORAGE_KEY).toBe("ep.session");
  });

  it("rejects malformed tokens and tokens without the required claims", () => {
    expect(sessionFromToken("not-a-jwt")).toBeNull();
    expect(sessionFromToken(buildMockToken({ ...claims, userId: 0 }).token)).toBeNull();
    expect(sessionFromToken(buildMockToken({ ...claims, email: undefined as unknown as string }).token)).toBeNull();
  });

  it("detects expiry", () => {
    const session = sessionFromToken(buildMockToken(claims, { lifetimeSeconds: 60 }).token)!;
    expect(isSessionExpired(session, Date.now())).toBe(false);
    expect(isSessionExpired(session, Date.now() + 61_000)).toBe(true);
  });

  it("ADMIN check is by role claim only (navigation rule)", () => {
    expect(isAdmin({ id: 1, email: "a", role: "ADMIN", displayName: null })).toBe(true);
    expect(isAdmin({ id: 2, email: "c", role: "CASHER", displayName: "Cashier" })).toBe(false);
    expect(isAdmin(null)).toBe(false);
  });
});

describe("session storage", () => {
  afterEach(() => clearStoredSession());

  it("stores, reads and clears the token", () => {
    const { token } = buildMockToken(claims);
    storeSession(token);
    expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBe(token);
    expect(readStoredSession()?.user.email).toBe("cashier@mock.local");
    expect(getAccessToken()).toBe(token);
    clearStoredSession();
    expect(readStoredSession()).toBeNull();
    expect(getAccessToken()).toBeNull();
  });

  it("never sends an expired token", () => {
    storeSession(buildMockToken(claims, { issuedAt: Math.floor(Date.now() / 1000) - 100, lifetimeSeconds: 50 }).token);
    expect(getAccessToken()).toBeNull();
  });

  it("keeps working in memory when storage is unavailable", () => {
    const { token } = buildMockToken(claims);
    const failing = () => {
      throw new Error("storage disabled");
    };
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(failing);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(failing);
    storeSession(token);
    expect(getAccessToken()).toBe(token);
  });
});
