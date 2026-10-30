/**
 * LIVE CONTRACT TEST (`yarn test:live`, vitest.live.config.ts) — the typed V2 clients and the error model
 * against the REAL local backend, and the MSW mocks compared with it request by request.
 *
 * Needs D:\Backend\pos running with `pnpm dev` (DEV database pos) and `pnpm dev:print-agent`.
 * Refuses any non-local API. Creates one real POS order in the DEV database.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getResponse } from "msw";
import { jwtDecode } from "jwt-decode";
import { apiBaseUrl } from "@/api/config";
import { ApiError } from "@/api/errors";
import { http, setUnauthorizedHandler } from "@/api/http";
import { login } from "@/api/v2/auth";
import { getCatalog, type CatalogCategory } from "@/api/v2/catalog";
import { createOrder, quoteOrder, type Order, type OrderLineInput, type OrderQuote } from "@/api/v2/orders";
import { clearStoredSession, sessionFromToken, storeSession } from "@/features/auth/session";
import { formatMoney } from "@/lib/money";
import { MOCK_CATALOG } from "@/mocks/fixtures/catalog";
import { MOCK_USERS } from "@/mocks/fixtures/users";
import { handlers } from "@/mocks/handlers";

const API = apiBaseUrl();
if (!["localhost", "127.0.0.1"].includes(new URL(API).hostname)) {
  throw new Error(`Live contract tests run only against the local backend, not ${API}.`);
}
const credentials = { email: String(import.meta.env.LIVE_EMAIL ?? ""), password: String(import.meta.env.LIVE_PASSWORD ?? "") };

/** Every request sent by the typed clients, to prove that no legacy endpoint is used. */
const requested: string[] = [];
http.interceptors.request.use((config) => {
  requested.push(`${config.method?.toUpperCase()} ${config.url}`);
  return config;
});

/** Every key path of a JSON value ("[].products[].variants[].unit.code"), merged over array elements. */
const shape = (value: unknown, prefix = "", paths = new Set<string>()): string[] => {
  if (Array.isArray(value)) value.forEach((item) => shape(item, `${prefix}[]`, paths));
  else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      const path = `${prefix}.${key}`;
      paths.add(path);
      shape(child, path, paths);
    }
  }
  return [...paths].sort();
};

/** The same raw request, answered by the real backend and by the MSW handlers. */
const realAndMock = async (path: string, init: RequestInit = {}) => {
  const request = () => new Request(`${API}${path}`, { ...init, headers: { "Content-Type": "application/json", ...init.headers } });
  const real = await fetch(request());
  const mock = await getResponse(handlers, request());
  if (!mock) throw new Error(`No mock handler for ${path}`);
  return { real: { status: real.status, body: await real.json() }, mock: { status: mock.status, body: await mock.json() } };
};

const post = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });
const rejection = (promise: Promise<unknown>) => promise.then(() => null, (error: unknown) => error as ApiError);

let accessToken = "";

beforeAll(async () => {
  if (!credentials.email || !credentials.password) throw new Error("Set LIVE_EMAIL and LIVE_PASSWORD (a local test user).");
  accessToken = (await login(credentials)).accessToken;
  storeSession(accessToken);
});

afterAll(() => clearStoredSession());

describe("sign-in: real backend vs mocks", () => {
  it("success has the same response shape and token claims; the session reads the real token", async () => {
    const cashier = MOCK_USERS.find((user) => user.role === "CASHER")!;
    const real = await fetch(`${API}/auth/login`, { ...post(credentials), headers: { "Content-Type": "application/json" } }).then((r) => r.json());
    const mock = await getResponse(handlers, new Request(`${API}/auth/login`, { ...post({ email: cashier.email, password: cashier.password }), headers: { "Content-Type": "application/json" } })).then((r) => r!.json());
    expect(shape(real)).toEqual(shape(mock));
    expect(real.message).toBe(mock.message);
    expect(Object.keys(jwtDecode(real.response.accessToken)).sort()).toEqual(Object.keys(jwtDecode(mock.response.accessToken)).sort());
    const session = sessionFromToken(real.response.accessToken);
    expect(session?.user).toMatchObject({ email: credentials.email, role: "CASHER" });
    expect(session?.expiresAt).toBe(real.response.expiresAt);
  });

  it("wrong credentials: identical 401 bodies", async () => {
    const { real, mock } = await realAndMock("/auth/login", post({ email: `nobody-${Date.now()}@pos-v2.local`, password: "wrong-password" }));
    expect(real).toEqual(mock);
  });

  it("invalid email and missing password: identical 422 bodies", async () => {
    for (const body of [{ email: "not-an-email", password: "x" }, { email: credentials.email }]) {
      const { real, mock } = await realAndMock("/auth/login", post(body));
      expect(real).toEqual(mock);
    }
  });

  it("missing and malformed tokens: identical 401 bodies", async () => {
    for (const headers of [{}, { Authorization: "Bearer not.a.jwt" }] as Record<string, string>[]) {
      const { real, mock } = await realAndMock("/catalog", { headers });
      expect(real).toEqual(mock);
    }
  });
});

describe("catalog", () => {
  let catalog: CatalogCategory[] = [];

  it("the typed client loads the real approved menu", async () => {
    catalog = await getCatalog();
    const products = catalog.flatMap((category) => category.products);
    expect(catalog).toHaveLength(8);
    expect(products).toHaveLength(57);
    expect(products.flatMap((product) => product.variants)).toHaveLength(100);
    expect(catalog.find((category) => category.nameEn === "Staff Meal")?.products).toEqual([]);
    expect(products.flatMap((product) => product.variants).every((variant) => formatMoney(variant.price) === variant.price)).toBe(true);
  });

  it("the mock catalog has exactly the real shape", () => {
    expect(shape(MOCK_CATALOG)).toEqual(shape(catalog));
  });
});

describe("quote and POS order (typed clients)", () => {
  let items: OrderLineInput[] = [];
  let quote: OrderQuote;
  let order: Order;

  const findVariant = async (productName: string, label: string) => {
    const product = (await getCatalog()).flatMap((category) => category.products).find((p) => p.nameEn === productName)!;
    return { product, variant: product.variants.find((v) => v.labelEn === label)! };
  };

  it("quote: the server prices variant, add-ons, discount and delivery", async () => {
    const pizza = await findVariant("Margherita", "Large · Regular");
    const penne = await findVariant("Penne Pesto", "Whole Wheat Penne");
    items = [
      { variantId: pizza.variant.id, quantity: 2, addOnIds: pizza.product.addOns.slice(0, 2).map((a) => a.addOnId), comment: "well done" },
      { variantId: penne.variant.id, quantity: 1, addOnIds: penne.product.addOns.map((a) => a.addOnId) },
    ];
    quote = await quoteOrder({ items, discountPercent: "10", delivery: { location: "Live contract test", time: "20:30", price: "1.500" } });
    expect(quote.items.map((line) => line.lineTotal)).toEqual(["14.000", "6.500"]);
    expect([quote.subtotal, quote.discountAmount, quote.deliveryPrice, quote.totalAmount]).toEqual(["20.500", "2.050", "1.500", "19.950"]);
  });

  it("create: a POS order with the quoted totals, printed through the agent", async () => {
    order = await createOrder({ items, paymentMethod: "CASH", discountPercent: "10", delivery: { location: "Live contract test", time: "20:30", price: "1.500" }, customer: { name: "Live Contract", phone: `076${Date.now().toString().slice(-7)}` } });
    expect(order).toMatchObject({ type: "POS", status: "ACTIVE", version: 0, totalAmount: quote.totalAmount, subtotal: quote.subtotal });
    expect(order.createdBy).toEqual({ type: "USER", id: sessionFromToken(accessToken)!.user.id, name: credentials.email });
    expect(order.kitchenPrint.status).toBe("SENT");
    expect(shape(order.items)).toEqual(shape(quote.items));
  });

  it("server errors map to ApiError kinds and codes", async () => {
    const chicken = (await findVariant("Penne Pesto", "Regular Penne")).product.addOns[0].addOnId;
    const pizza = await findVariant("Margherita", "Medium · Regular");
    const notAvailable = await rejection(quoteOrder({ items: [{ variantId: pizza.variant.id, quantity: 1, addOnIds: [chicken] }] }));
    expect([notAvailable?.kind, notAvailable?.code]).toEqual(["validation", "ADDON_NOT_AVAILABLE"]);

    await http.patch(`/orders/${order.id}`, { version: 0, paymentMethod: "VISA" });
    const stale = await rejection(http.patch(`/orders/${order.id}`, { version: 0, paymentMethod: "CLIQ" }));
    expect([stale?.kind, stale?.status, stale?.code]).toEqual(["conflict", 409, "ORDER_VERSION_CONFLICT"]);

    const missing = await rejection(http.get("/orders/999999"));
    expect([missing?.kind, missing?.code]).toEqual(["notFound", "ORDER_NOT_FOUND"]);
  });
});

describe("session", () => {
  it("a token the server rejects reaches the 401 handler (the app signs out)", async () => {
    const [header, payload] = accessToken.split(".");
    storeSession(`${header}.${payload}.tampered-signature`);
    const seen: ApiError[] = [];
    const unsubscribe = setUnauthorizedHandler((error) => seen.push(error));
    try {
      const error = await rejection(getCatalog());
      expect([error?.kind, error?.code]).toEqual(["unauthorized", "INVALID_TOKEN"]);
      expect(seen.map((e) => e.code)).toEqual(["INVALID_TOKEN"]);
    } finally {
      unsubscribe();
      storeSession(accessToken);
    }
  });

  it("only V2 endpoints were called — never a legacy one", () => {
    expect(requested.length).toBeGreaterThan(0);
    for (const call of requested) {
      expect(call).toMatch(/^(POST \/auth\/login|GET \/catalog|POST \/orders(\/quote)?|PATCH \/orders\/\d+|GET \/orders\/\d+)$/);
    }
  });
});
