import { http, HttpResponse } from "msw";
import { buildMockToken, readMockToken } from "./jwt";
import { MOCK_CATALOG } from "./fixtures/catalog";
import { MOCK_USERS } from "./fixtures/users";

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

export const resetMockState = () => failures.clear();

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
];
