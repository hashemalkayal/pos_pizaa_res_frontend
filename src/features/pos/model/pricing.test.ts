import { describe, expect, it } from "vitest";
import { fromFils } from "@/lib/money";
import { MOCK_CATALOG } from "@/mocks/fixtures/catalog";
import * as backendMirror from "@/mocks/orderStore";
import type { LineConfig } from "./cart";
import { indexCatalog } from "./catalogView";
import { lineInputs } from "./orderDraft";
import { cashState } from "./payment";
import { discountFils, orderTotals, priceCart, priceLine, totalAmount } from "./pricing";

const index = indexCatalog(MOCK_CATALOG);
const product = (name: string) => MOCK_CATALOG.flatMap((category) => category.products).find((candidate) => candidate.nameEn === name)!;
const margherita = product("Margherita");
const line = (overrides: Partial<LineConfig> = {}): LineConfig => ({ productId: 1, variantId: 101, addOnIds: [], quantity: 1, comment: null, ...overrides });
const money = (totals: ReturnType<typeof orderTotals>) => ({
  subtotal: fromFils(totals.subtotalFils),
  discountPercent: totals.discountPercent,
  discount: fromFils(totals.discountFils),
  delivery: fromFils(totals.deliveryFils),
  total: fromFils(totals.totalFils),
});

describe("local pricing — lines", () => {
  it("(variant + add-ons) × quantity, from the catalog's prices", () => {
    // Large regular 5.000 + Extra Tomato Sauce 1.000 + Extra Basil 1.000, × 3
    expect(priceLine(margherita, { variantId: 102, addOnIds: [1, 3], quantity: 3 })).toEqual({ unitFils: 5000, addOnsUnitFils: 2000, lineTotalFils: 21000 });
    expect(priceLine(margherita, { variantId: 101, addOnIds: [], quantity: 1 })?.lineTotalFils).toBe(4000);
    expect(priceLine(product("Water"), { variantId: 100, addOnIds: [], quantity: 99 })?.lineTotalFils).toBe(49500);
  });

  it("a variant or add-on the catalog does not sell cannot be priced (the backend would refuse it)", () => {
    expect(priceLine(margherita, { variantId: 236, addOnIds: [], quantity: 1 })).toBeNull(); // pasta variant
    expect(priceLine(margherita, { variantId: 101, addOnIds: [4], quantity: 1 })).toBeNull(); // pasta's add-on
    const archived = { ...margherita, variants: margherita.variants.map((variant) => ({ ...variant, archived: variant.id === 101 })) };
    expect(priceLine(archived, { variantId: 101, addOnIds: [], quantity: 1 })).toBeNull();
    const inactive = { ...margherita, variants: margherita.variants.map((variant) => ({ ...variant, isActive: variant.id !== 102 })) };
    expect(priceLine(inactive, { variantId: 102, addOnIds: [], quantity: 1 })).toBeNull();
  });
});

describe("local pricing — totals (the backend's formula)", () => {
  it("subtotal − percentage discount + delivery fee (the brief's example)", () => {
    expect(money(orderTotals([12000, 8000], "10", "1.500"))).toEqual({ subtotal: "20.000", discountPercent: "10.00", discount: "2.000", delivery: "1.500", total: "19.500" });
  });

  it("dine-in has no delivery fee; zero and 100 % discounts", () => {
    expect(money(orderTotals([20000]))).toEqual({ subtotal: "20.000", discountPercent: "0.00", discount: "0.000", delivery: "0.000", total: "20.000" });
    expect(money(orderTotals([20000], "0", "0"))).toMatchObject({ discount: "0.000", total: "20.000" });
    expect(money(orderTotals([20000], "100", "2"))).toEqual({ subtotal: "20.000", discountPercent: "100.00", discount: "20.000", delivery: "2.000", total: "2.000" });
  });

  it("three-decimal JOD amounts add up exactly (no floating point)", () => {
    expect(fromFils(orderTotals([100, 200]).totalFils)).toBe("0.300");
    expect(fromFils(orderTotals(Array.from({ length: 50 }, () => 7770 * 99)).totalFils)).toBe("38461.500");
  });

  it.each([
    // subtotal, percent, discount — round half up to 3 decimals, as the backend (Decimal ROUND_HALF_UP)
    ["1.005", "12.5", "0.126"], // 0.125625
    ["0.333", "50", "0.167"], // 0.1665 → up
    ["0.001", "50", "0.001"], // 0.0005 → up
    ["0.001", "49.99", "0.000"], // 0.00049990
    ["7.775", "33.33", "2.591"], // 2.5914075
    ["10.000", "33.33", "3.333"],
    ["9999999.999", "99.99", "9998999.999"], // 9998999.9990001 — exact beyond 2^53 thanks to BigInt
  ])("discount of %s at %s %% = %s", (subtotal, percent, discount) => {
    const subtotalFils = Math.round(Number(subtotal) * 1000);
    expect(fromFils(discountFils(subtotalFils, percent))).toBe(discount);
  });
});

describe("local pricing — cart", () => {
  it("prices every line and the totals with exactly the discount and delivery that checkout sends", () => {
    const lines = [line({ variantId: 102, addOnIds: [1, 3], quantity: 2 }), line({ productId: 56, variantId: 99, quantity: 3 })];
    const pricing = priceCart(index, lines, { discountPercent: "12.5", deliveryPrice: "1.250" });
    expect(pricing.lines.map((priced) => priced?.lineTotalFils)).toEqual([14000, 1500]);
    expect(money(pricing.totals)).toEqual({ subtotal: "15.500", discountPercent: "12.50", discount: "1.938", delivery: "1.250", total: "14.812" });
    expect(pricing.complete).toBe(true);
    expect(totalAmount(pricing)).toBe("14.812");
    // Cash against the same total: 20.000 received → 5.188 change.
    expect(cashState(pricing.totals.totalFils, "20")).toEqual({ receivedFils: 20000, changeFils: 5188, sufficient: true });
  });

  it("a line that can no longer be priced makes the cart incomplete (checkout is blocked)", () => {
    const pricing = priceCart(index, [line(), line({ variantId: 999999 })]);
    expect(pricing.lines[1]).toBeNull();
    expect(pricing.complete).toBe(false);
  });

  it("combined total of several configurations of one product (the product dialog)", () => {
    const configs = [line({ quantity: 2, addOnIds: [3] }), line({ variantId: 102 }), line({ variantId: 103, addOnIds: [2] })];
    const totals = orderTotals(configs.map((config) => priceLine(margherita, config)?.lineTotalFils ?? 0));
    expect(fromFils(totals.totalFils)).toBe("21.000"); // 2 × 5.000 + 5.000 + 6.000
  });

  it("matches the backend mirror (src/mocks: the backend's pricing in its own code) on many random carts", () => {
    const variants = MOCK_CATALOG.flatMap((category) => category.products.flatMap((candidate) => candidate.variants.map((variant) => ({ variant, product: candidate }))));
    let seed = 7;
    const random = (max: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % max;
    };
    for (let run = 0; run < 200; run += 1) {
      const lines = Array.from({ length: 1 + random(6) }, () => {
        const { variant, product: owner } = variants[random(variants.length)];
        const addOnIds = owner.addOns.filter(() => random(2) === 1).map((addOn) => addOn.addOnId);
        return line({ productId: owner.id, variantId: variant.id, addOnIds, quantity: 1 + random(99) });
      });
      const discountPercent = random(3) === 0 ? undefined : `${random(101)}${random(2) ? `.${random(100)}` : ""}`.replace(/^100\..*/, "100");
      const deliveryPrice = random(2) ? `${random(10)}.${String(random(1000)).padStart(3, "0")}` : undefined;
      const local = priceCart(index, lines, { discountPercent, deliveryPrice });
      const mirror = backendMirror.quote({ items: lineInputs(lines), discountPercent, delivery: deliveryPrice ? { price: deliveryPrice } : undefined });
      expect(local.lines.map((priced) => fromFils(priced!.lineTotalFils))).toEqual(mirror.items.map((item) => item.lineTotal));
      expect(money(local.totals)).toEqual({ subtotal: mirror.subtotal, discountPercent: mirror.discountPercent, discount: mirror.discountAmount, delivery: mirror.deliveryPrice, total: mirror.totalAmount });
    }
  });
});
