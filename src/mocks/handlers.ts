import { http, HttpResponse } from "msw";
import { buildMockToken, readMockToken } from "./jwt";
import { MOCK_CATALOG } from "./fixtures/catalog";
import { MOCK_USERS } from "./fixtures/users";
import * as store from "./orderStore";

/**
 * DEVELOPMENT/TEST ONLY. Each handler reproduces the backend V2 contract for one route: status codes,
 * body shapes and messages as implemented in the backend (paths match any base URL ending in /api).
 */

/** Backend AppError body: { message, statusCode, code, error: { code, details } }. */
export const appError = (status: number, code: string, message: string, details: unknown = null, headers?: HeadersInit) =>
  HttpResponse.json({ message, statusCode: status, code, error: { code, details } }, { status, headers });

const envelope = <T>(response: T, message: string, status = 200) => HttpResponse.json({ response, message }, { status });

/** authMiddleware (D66): missing / invalid / expired token → 401 with the backend's codes and messages. */
const authenticate = (request: Request) => {
  const match = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i);
  if (!match) return { error: appError(401, "TOKEN_MISSING", "unauthorized no token") };
  const claims = readMockToken(match[1]);
  if (!claims || typeof claims.exp !== "number") return { error: appError(401, "INVALID_TOKEN", "unauthorized invalid token") };
  if (claims.exp * 1000 <= Date.now()) return { error: appError(401, "TOKEN_EXPIRED", "unauthorized token expired") };
  if (!MOCK_USERS.some((user) => user.id === claims.userId)) return { error: appError(401, "USER_NOT_FOUND", "unauthorized user not found") };
  return { claims };
};

// login.controller.ts (D63): 5 failed attempts per email within 15 minutes → 429.
const LOGIN_WINDOW_SECONDS = 15 * 60;
const MAX_FAILURES_PER_EMAIL = 5;
const failures = new Map<string, { count: number; resetAt: number }>();

export const resetMockState = () => {
  failures.clear();
  store.resetOrderStore();
};

/** Runs a store operation; a MockError becomes the backend's AppError body. */
const attempt = (run: () => Response) => {
  try {
    return run();
  } catch (error) {
    if (error instanceof store.MockError) return appError(error.status, error.code, error.message, error.details);
    throw error;
  }
};

const readJson = (request: Request): Promise<unknown> => request.json().catch(() => ({}));

/** parseIdParam(): anything but a positive integer → 404 with the route's not-found code. */
const routeId = (value: string | readonly string[] | undefined, code: string) => {
  const id = typeof value === "string" && /^[1-9]d{0,9}$/.test(value) ? Number(value) : null;
  if (id === null) throw new store.MockError(404, code, "The record was not found.");
  return id;
};

/** pageQuery: 1 ≤ pageSize ≤ 200, default 50. */
const pageSizeOf = (url: URL) => {
  const value = url.searchParams.get("pageSize");
  if (value === null) return 50;
  const size = Number(value);
  if (!Number.isInteger(size) || size < 1 || size > 200) throw new store.MockError(422, "VALIDATION_ERROR", "The request is invalid.", { errors: [{ field: "pageSize", message: "pageSize must be between 1 and 200" }] });
  return size;
};

export const handlers = [
  http.post("*/api/auth/login", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { email?: unknown; password?: unknown };
    const email = typeof body.email === "string" ? body.email : "";
    const password = typeof body.password === "string" ? body.password : "";

    // validateRequest(loginSchema): { message: "Unprocessable Entity", errors: [{ field, message }] }
    const errors = [
      ...(!email ? [{ field: "email", message: "Email is required" }] : !/^\S+@\S+\.\S+$/.test(email) ? [{ field: "email", message: "Invalid email" }] : []),
      ...(!password ? [{ field: "password", message: "Password is required" }] : []),
    ];
    if (errors.length) return HttpResponse.json({ message: "Unprocessable Entity", errors }, { status: 422 });

    const key = email.trim().toLowerCase();
    const now = Date.now();
    const record = failures.get(key);
    if (record && record.resetAt > now && record.count >= MAX_FAILURES_PER_EMAIL) {
      const retryAfter = Math.ceil((record.resetAt - now) / 1000);
      return HttpResponse.json(
        {
          message: "Too many failed login attempts. Try again later.",
          statusCode: 429,
          code: "RATE_LIMITED",
          error: { code: "RATE_LIMITED", details: { retryAfterSeconds: retryAfter } },
        },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const user = MOCK_USERS.find((candidate) => candidate.email === email && candidate.password === password);
    if (!user) {
      const current = record && record.resetAt > now ? record : { count: 0, resetAt: now + LOGIN_WINDOW_SECONDS * 1000 };
      failures.set(key, { ...current, count: current.count + 1 });
      return envelope({}, "Invalid email or password", 401);
    }

    const { token, exp } = buildMockToken({ userId: user.id, email: user.email, role: user.role });
    return envelope({ accessToken: token, expiresAt: new Date(exp * 1000).toISOString() }, "Login successful");
  }),

  http.get("*/api/catalog", ({ request }) => {
    const auth = authenticate(request);
    if (auth.error) return auth.error;
    return envelope(MOCK_CATALOG, "Catalog fetched.");
  }),

  http.post("*/api/orders/quote", async ({ request }) => {
    const auth = authenticate(request);
    if (auth.error) return auth.error;
    const body = await readJson(request);
    return attempt(() => envelope(store.quote(store.validateQuote(body)), "Order priced."));
  }),

  http.post("*/api/orders", async ({ request }) => {
    const auth = authenticate(request);
    if (auth.error) return auth.error;
    const body = await readJson(request);
    const user = MOCK_USERS.find((candidate) => candidate.id === auth.claims.userId);
    return attempt(() => envelope(store.createOrder(store.validateCreate(body), { id: auth.claims.userId, name: user?.name ?? null }), "Order created.", 201));
  }),

  http.get("*/api/orders", ({ request }) => {
    const auth = authenticate(request);
    if (auth.error) return auth.error;
    const url = new URL(request.url);
    const number = (name: string) => (url.searchParams.has(name) ? Number(url.searchParams.get(name)) : undefined);
    return attempt(() =>
      envelope(
        store.listOrders({
          createdByUserId: number("createdByUserId"),
          type: url.searchParams.get("type") ?? undefined,
          businessDate: url.searchParams.get("businessDate") ?? undefined,
          pageSize: pageSizeOf(url),
        }),
        "Orders fetched."
      )
    );
  }),

  http.get("*/api/orders/:id", ({ request, params }) => {
    const auth = authenticate(request);
    if (auth.error) return auth.error;
    return attempt(() => envelope(store.findOrder(routeId(params.id, "ORDER_NOT_FOUND")), "Order fetched."));
  }),

  http.get("*/api/customers", ({ request }) => {
    const auth = authenticate(request);
    if (auth.error) return auth.error;
    const url = new URL(request.url);
    return attempt(() => envelope(store.searchCustomers(url.searchParams.get("q"), pageSizeOf(url)), "Customers fetched."));
  }),

  http.post("*/api/customers", async ({ request }) => {
    const auth = authenticate(request);
    if (auth.error) return auth.error;
    const body = await readJson(request);
    return attempt(() => envelope(store.createCustomer(store.validateCustomer(body)), "Customer created.", 201));
  }),

  http.get("*/api/customers/:id", ({ request, params }) => {
    const auth = authenticate(request);
    if (auth.error) return auth.error;
    return attempt(() => envelope(store.findCustomer(routeId(params.id, "CUSTOMER_NOT_FOUND")), "Customer fetched."));
  }),
];
