import { http, HttpResponse } from "msw";
import { buildMockToken, readMockToken } from "./jwt";
import { MOCK_USERS } from "./fixtures/users";
import * as menu from "./menuStore";
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
  menu.resetMenuStore();
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
  const id = typeof value === "string" && /^[1-9]\d{0,9}$/.test(value) ? Number(value) : null;
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

/** D80: changing the menu needs an ADMIN (the stored role, as the backend's requireAdminMiddleware reads it). */
const authenticateAdmin = (request: Request) => {
  const auth = authenticate(request);
  if (auth.error) return auth;
  if (MOCK_USERS.find((user) => user.id === auth.claims.userId)?.role !== "ADMIN") return { error: HttpResponse.json({ message: "forbidden admin only" }, { status: 403 }) };
  return auth;
};

const MONEY = /^\d{1,7}(\.\d{1,3})?$/;
/** The backend's Yup checks of the menu bodies: required trimmed names, amounts with at most 3 decimals. */
const checkMenuBody = (body: unknown, rules: { names?: number; price?: boolean; partial?: boolean }) => {
  const value = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const errors: { field: string; message: string }[] = [];
  for (const field of rules.names ? ["nameEn", "nameAr"] : []) {
    const text = value[field];
    if (text === undefined && rules.partial) continue;
    if (typeof text !== "string" || !text.trim()) errors.push({ field, message: `${field} is a required field` });
    else if (text.trim().length > rules.names!) errors.push({ field, message: `${field} must be at most ${rules.names} characters` });
  }
  if (rules.price && !(value.price === undefined && rules.partial) && !(typeof value.price === "string" && MONEY.test(value.price.trim()))) {
    errors.push({ field: "price", message: "must be an amount ≥ 0 with at most 3 decimals" });
  }
  if (errors.length) throw new store.MockError(422, "VALIDATION_ERROR", "The request is invalid.", { errors });
  return value as never;
};

const listQuery = (request: Request) => {
  const url = new URL(request.url);
  const number = (name: string) => (url.searchParams.has(name) ? Number(url.searchParams.get(name)) : undefined);
  return { categoryId: number("categoryId"), q: url.searchParams.get("q") ?? undefined, page: number("page"), pageSize: number("pageSize") };
};

/** Menu management (D80): reads for every signed-in user, changes for ADMIN only. */
const menuHandlers = [
  http.get("*/api/categories", ({ request }) => {
    const auth = authenticate(request);
    if (auth.error) return auth.error;
    return envelope(menu.listCategories(), "Categories fetched.");
  }),
  http.post("*/api/categories", async ({ request }) => {
    const auth = authenticateAdmin(request);
    if (auth.error) return auth.error;
    const body = await readJson(request);
    return attempt(() => envelope(menu.createCategory(checkMenuBody(body, { names: 191 })), "Category created.", 201));
  }),
  http.patch("*/api/categories/:id", async ({ request, params }) => {
    const auth = authenticateAdmin(request);
    if (auth.error) return auth.error;
    const body = await readJson(request);
    return attempt(() => envelope(menu.updateCategory(routeId(params.id, "CATEGORY_NOT_FOUND"), checkMenuBody(body, { names: 191, partial: true })), "Category updated."));
  }),
  http.post("*/api/categories/:id/archive", ({ request, params }) => {
    const auth = authenticateAdmin(request);
    if (auth.error) return auth.error;
    return attempt(() => envelope(menu.archiveCategory(routeId(params.id, "CATEGORY_NOT_FOUND")), "Category deleted."));
  }),

  http.get("*/api/products", ({ request }) => {
    const auth = authenticate(request);
    if (auth.error) return auth.error;
    return envelope(menu.listProducts(listQuery(request)), "Products fetched.");
  }),
  http.post("*/api/products", async ({ request }) => {
    const auth = authenticateAdmin(request);
    if (auth.error) return auth.error;
    const body = await readJson(request);
    return attempt(() => envelope(menu.createProduct(checkMenuBody(body, { names: 191 })), "Product created.", 201));
  }),
  http.get("*/api/products/:id", ({ request, params }) => {
    const auth = authenticate(request);
    if (auth.error) return auth.error;
    return attempt(() => envelope(menu.getProduct(routeId(params.id, "PRODUCT_NOT_FOUND")), "Product fetched."));
  }),
  http.patch("*/api/products/:id", async ({ request, params }) => {
    const auth = authenticateAdmin(request);
    if (auth.error) return auth.error;
    const body = await readJson(request);
    return attempt(() => envelope(menu.updateProduct(routeId(params.id, "PRODUCT_NOT_FOUND"), checkMenuBody(body, { names: 191, partial: true })), "Product updated."));
  }),
  http.post("*/api/products/:id/archive", ({ request, params }) => {
    const auth = authenticateAdmin(request);
    if (auth.error) return auth.error;
    return attempt(() => envelope(menu.archiveProduct(routeId(params.id, "PRODUCT_NOT_FOUND")), "Product archived."));
  }),
  http.get("*/api/products/:id/variants", ({ request, params }) => {
    const auth = authenticate(request);
    if (auth.error) return auth.error;
    return attempt(() => envelope(menu.listVariants(routeId(params.id, "PRODUCT_NOT_FOUND")), "Variants fetched."));
  }),
  http.post("*/api/products/:id/variants", async ({ request, params }) => {
    const auth = authenticateAdmin(request);
    if (auth.error) return auth.error;
    const body = await readJson(request);
    return attempt(() => envelope(menu.createVariant(routeId(params.id, "PRODUCT_NOT_FOUND"), checkMenuBody(body, { price: true })), "Variant created.", 201));
  }),
  http.patch("*/api/products/:id/variants/:variantId", async ({ request, params }) => {
    const auth = authenticateAdmin(request);
    if (auth.error) return auth.error;
    const body = await readJson(request);
    return attempt(() =>
      envelope(menu.updateVariant(routeId(params.id, "PRODUCT_NOT_FOUND"), routeId(params.variantId, "VARIANT_NOT_FOUND"), checkMenuBody(body, { price: true, partial: true })), "Variant updated.")
    );
  }),
  http.post("*/api/products/:id/variants/:variantId/archive", ({ request, params }) => {
    const auth = authenticateAdmin(request);
    if (auth.error) return auth.error;
    return attempt(() => envelope(menu.archiveVariant(routeId(params.id, "PRODUCT_NOT_FOUND"), routeId(params.variantId, "VARIANT_NOT_FOUND")), "Variant archived."));
  }),
  http.put("*/api/products/:id/add-ons/:addOnId", async ({ request, params }) => {
    const auth = authenticateAdmin(request);
    if (auth.error) return auth.error;
    const body = await readJson(request);
    return attempt(() =>
      envelope(menu.setProductAddOn(routeId(params.id, "PRODUCT_NOT_FOUND"), routeId(params.addOnId, "ADDON_NOT_FOUND"), checkMenuBody(body, { price: true })), "Product add-on saved.")
    );
  }),

  http.get("*/api/add-ons", ({ request }) => {
    const auth = authenticate(request);
    if (auth.error) return auth.error;
    return envelope(menu.listAddOns(listQuery(request)), "Add-ons fetched.");
  }),
  http.post("*/api/add-ons", async ({ request }) => {
    const auth = authenticateAdmin(request);
    if (auth.error) return auth.error;
    const body = await readJson(request);
    return attempt(() => envelope(menu.createAddOn(checkMenuBody(body, { names: 100 })), "Add-on created.", 201));
  }),
  http.get("*/api/add-ons/:id", ({ request, params }) => {
    const auth = authenticate(request);
    if (auth.error) return auth.error;
    return attempt(() => envelope(menu.getAddOn(routeId(params.id, "ADDON_NOT_FOUND")), "Add-on fetched."));
  }),
  http.patch("*/api/add-ons/:id", async ({ request, params }) => {
    const auth = authenticateAdmin(request);
    if (auth.error) return auth.error;
    const body = await readJson(request);
    return attempt(() => envelope(menu.updateAddOn(routeId(params.id, "ADDON_NOT_FOUND"), checkMenuBody(body, { names: 100, partial: true })), "Add-on updated."));
  }),
  http.post("*/api/add-ons/:id/archive", ({ request, params }) => {
    const auth = authenticateAdmin(request);
    if (auth.error) return auth.error;
    return attempt(() => envelope(menu.archiveAddOn(routeId(params.id, "ADDON_NOT_FOUND")), "Add-on deleted."));
  }),

  http.get("*/api/units", ({ request }) => {
    const auth = authenticate(request);
    if (auth.error) return auth.error;
    return envelope(menu.listUnits(), "Units fetched.");
  }),
  http.get("*/api/option-groups", ({ request }) => {
    const auth = authenticate(request);
    if (auth.error) return auth.error;
    return envelope(menu.listOptionGroups(), "Option groups fetched.");
  }),
];

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
    return envelope(menu.getMenu(), "Catalog fetched.");
  }),

  ...menuHandlers,

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
          orderNumber: number("orderNumber"),
          status: url.searchParams.get("status") ?? undefined,
          service: url.searchParams.get("service") ?? undefined,
          page: number("page") ?? 1,
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

  http.patch("*/api/orders/:id", async ({ request, params }) => {
    const auth = authenticate(request);
    if (auth.error) return auth.error;
    const body = await readJson(request);
    return attempt(() => envelope(store.updateOrderCustomer(routeId(params.id, "ORDER_NOT_FOUND"), body), "Order updated."));
  }),

  http.post("*/api/orders/:id/void", async ({ request, params }) => {
    const auth = authenticate(request);
    if (auth.error) return auth.error;
    const body = await readJson(request);
    return attempt(() => envelope(store.voidOrder(routeId(params.id, "ORDER_NOT_FOUND"), body), "Order voided."));
  }),

  http.post("*/api/orders/:id/print", ({ request, params }) => {
    const auth = authenticate(request);
    if (auth.error) return auth.error;
    return attempt(() => envelope(store.printOrder(routeId(params.id, "ORDER_NOT_FOUND")), "Order sent to printer."));
  }),

  http.get("*/api/customers", ({ request }) => {
    const auth = authenticate(request);
    if (auth.error) return auth.error;
    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page") ?? 1);
    return attempt(() => envelope(store.searchCustomers(url.searchParams.get("q"), pageSizeOf(url), Number.isInteger(page) && page > 0 ? page : 1), "Customers fetched."));
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

  http.patch("*/api/customers/:id", async ({ request, params }) => {
    const auth = authenticate(request);
    if (auth.error) return auth.error;
    const body = await readJson(request);
    return attempt(() => envelope(store.updateCustomer(routeId(params.id, "CUSTOMER_NOT_FOUND"), store.validateCustomerUpdate(body)), "Customer updated."));
  }),

  http.delete("*/api/customers/:id", ({ request, params }) => {
    const auth = authenticate(request);
    if (auth.error) return auth.error;
    return attempt(() => envelope(store.deleteCustomer(routeId(params.id, "CUSTOMER_NOT_FOUND")), "Customer deleted."));
  }),
];
