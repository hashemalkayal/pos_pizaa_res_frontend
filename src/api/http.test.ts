import { http as mswHttp, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { server } from "@/test/server";
import { signInAs } from "@/test/renderApp";
import { MOCK_CATALOG } from "@/mocks/fixtures/catalog";
import { appError } from "@/mocks/handlers";
import { ApiError } from "./errors";
import { setUnauthorizedHandler } from "./http";
import { login } from "./v2/auth";
import { getCatalog } from "./v2/catalog";

describe("typed V2 client", () => {
  it("sends the Bearer token and unwraps { response } (GET /api/catalog)", async () => {
    const { token } = signInAs("CASHER");
    const seen = vi.fn();
    server.events.on("request:start", ({ request }) => seen(request.headers.get("authorization")));
    const categories = await getCatalog();
    server.events.removeAllListeners();
    expect(seen).toHaveBeenCalledWith(`Bearer ${token}`);
    expect(categories).toEqual(MOCK_CATALOG);
    expect(categories.at(-1)).toMatchObject({ nameEn: "Staff Meal", products: [] });
  });

  it("a 401 on an authenticated call ends the session through the registered handler", async () => {
    const onUnauthorized = vi.fn();
    const unregister = setUnauthorizedHandler(onUnauthorized);
    await expect(getCatalog()).rejects.toMatchObject({ kind: "unauthorized", code: "TOKEN_MISSING" });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(onUnauthorized.mock.calls[0][0]).toBeInstanceOf(ApiError);
    unregister();
  });

  it("a 401 from sign-in (wrong password) does not end any session", async () => {
    const onUnauthorized = vi.fn();
    const unregister = setUnauthorizedHandler(onUnauthorized);
    await expect(login({ email: "admin@mock.local", password: "wrong" })).rejects.toMatchObject({ kind: "unauthorized" });
    expect(onUnauthorized).not.toHaveBeenCalled();
    unregister();
  });

  it("503 CUTOVER_PENDING surfaces as its own error kind (no fallback to legacy APIs)", async () => {
    signInAs("ADMIN");
    const legacyCall = vi.fn();
    server.use(
      mswHttp.get("*/api/catalog", () => appError(503, "CUTOVER_PENDING", "This POS V2 endpoint is available after the approved database cutover.")),
      mswHttp.all("*/api/item*", () => {
        legacyCall();
        return HttpResponse.json({});
      })
    );
    await expect(getCatalog()).rejects.toMatchObject({ kind: "cutoverPending", status: 503 });
    expect(legacyCall).not.toHaveBeenCalled();
  });
});
