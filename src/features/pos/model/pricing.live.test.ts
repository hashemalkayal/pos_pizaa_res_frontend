/**
 * LIVE PRICING PARITY (`yarn test:live`, vitest.live.config.ts) — local pricing (model/pricing.ts) against the
 * REAL backend's quote, on the real DEV catalog: every line total, subtotal, discount, delivery fee and total
 * must be identical. Read-only: POST /api/orders/quote creates nothing. Refuses any non-local API.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiBaseUrl } from "@/api/config";
import { login } from "@/api/auth";
import { getCatalog } from "@/api/catalog";
import { quoteOrder } from "@/api/orders";
import { clearStoredSession, storeSession } from "@/features/auth/session";
import { fromFils } from "@/lib/money";
import type { LineConfig } from "./cart";
import { indexCatalog, sellableVariants } from "./catalogView";
import { lineInputs } from "./orderDraft";
import { priceCart } from "./pricing";

const API = apiBaseUrl();
if (!["localhost", "127.0.0.1"].includes(new URL(API).hostname)) {
  throw new Error(`Live tests run only against the local backend, not ${API}.`);
}
const credentials = { email: String(import.meta.env.LIVE_EMAIL ?? ""), password: String(import.meta.env.LIVE_PASSWORD ?? "") };

beforeAll(async () => {
  if (!credentials.email || !credentials.password) throw new Error("Set LIVE_EMAIL and LIVE_PASSWORD (a local test user).");
  storeSession((await login(credentials)).accessToken);
});
afterAll(() => clearStoredSession());

describe("local pricing = backend quote (real catalog)", () => {
  it("matches on carts with real variants, add-ons, quantities, discounts and delivery fees", async () => {
    const catalog = await getCatalog();
    const index = indexCatalog(catalog);
    const products = catalog.flatMap((category) => category.products).filter((product) => sellableVariants(product).length);
    const discounts = [undefined, "0.01", "5", "10", "12.5", "33.33", "50", "66.67", "99.99", "100"];
    const fees = [undefined, "0", "0.5", "1.250", "2.999"];
    let seed = 2026;
    const random = (max: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % max;
    };

    for (let run = 0; run < 40; run += 1) {
      const lines: LineConfig[] = Array.from({ length: 1 + random(5) }, () => {
        const product = products[random(products.length)];
        const variants = sellableVariants(product);
        return {
          productId: product.id,
          variantId: variants[random(variants.length)].id,
          addOnIds: product.addOns.filter(() => random(3) === 0).map((addOn) => addOn.addOnId),
          quantity: random(4) === 0 ? 99 : 1 + random(9),
          comment: null,
        };
      });
      const discountPercent = discounts[random(discounts.length)];
      const deliveryPrice = fees[random(fees.length)];

      const local = priceCart(index, lines, { discountPercent, deliveryPrice });
      const real = await quoteOrder({ items: lineInputs(lines), ...(discountPercent ? { discountPercent } : {}), ...(deliveryPrice ? { delivery: { price: deliveryPrice } } : {}) });

      const cart = JSON.stringify({ lines: lineInputs(lines), discountPercent, deliveryPrice });
      expect(local.complete, cart).toBe(true);
      expect(local.lines.map((line) => fromFils(line!.lineTotalFils)), cart).toEqual(real.items.map((item) => item.lineTotal));
      expect(
        {
          subtotal: fromFils(local.totals.subtotalFils),
          discountPercent: local.totals.discountPercent,
          discountAmount: fromFils(local.totals.discountFils),
          deliveryPrice: fromFils(local.totals.deliveryFils),
          totalAmount: fromFils(local.totals.totalFils),
        },
        cart
      ).toEqual({ subtotal: real.subtotal, discountPercent: real.discountPercent, discountAmount: real.discountAmount, deliveryPrice: real.deliveryPrice, totalAmount: real.totalAmount });
    }
  });
});
