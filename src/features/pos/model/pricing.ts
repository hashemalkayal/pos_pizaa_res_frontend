import type { CatalogProduct } from "@/api/v2/catalog";
import { fromFils, toFils } from "@/lib/money";
import type { LineConfig } from "./cart";
import { sellableVariants, type CatalogIndex } from "./catalogView";

/**
 * Local pricing: every amount the cashier sees, computed at once from the loaded catalog (no request).
 * The backend's formula (src/services/order/order-pricing.ts), in exact integer fils (1 JOD = 1000 fils):
 *   addOnsUnitPrice = Σ prices of the selected add-ons (the product's price for each)
 *   lineTotal       = (unitPrice + addOnsUnitPrice) × quantity
 *   subtotal        = Σ lineTotal
 *   discountAmount  = round half up(subtotal × discountPercent / 100, 3)
 *   totalAmount     = subtotal − discountAmount + deliveryPrice
 * The backend still prices every order itself: checkout sends the total shown as `expectedTotal`, and a
 * different server total is refused (409 PRICE_MISMATCH, D77), so the cashier never charges another amount.
 */

export interface LinePrice {
  unitFils: number;
  addOnsUnitFils: number;
  lineTotalFils: number;
}

/**
 * One line, or null when the catalog no longer sells this variant or one of these add-ons for the product
 * (the backend would refuse it: VARIANT_UNAVAILABLE, VARIANT_NOT_FOUND, ADDON_NOT_AVAILABLE).
 */
export const priceLine = (product: CatalogProduct, line: Pick<LineConfig, "variantId" | "addOnIds" | "quantity">): LinePrice | null => {
  const variant = sellableVariants(product).find((candidate) => candidate.id === line.variantId);
  if (!variant) return null;
  let addOnsUnitFils = 0;
  for (const addOnId of line.addOnIds) {
    const addOn = product.addOns.find((candidate) => candidate.addOnId === addOnId);
    if (!addOn) return null;
    addOnsUnitFils += toFils(addOn.price);
  }
  const unitFils = toFils(variant.price);
  return { unitFils, addOnsUnitFils, lineTotalFils: (unitFils + addOnsUnitFils) * line.quantity };
};

/** "12.5" → 1250 (hundredths of a percent); the input is a valid percentage (0–100, at most 2 decimals). */
const percentHundredths = (percent: string) => {
  const [whole, fraction = ""] = percent.trim().split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
};

/** round half up(subtotal × percent / 100) in fils. BigInt keeps the product exact for any order size. */
export const discountFils = (subtotalFils: number, discountPercent: string) =>
  Number((BigInt(subtotalFils) * BigInt(percentHundredths(discountPercent)) + BigInt(5000)) / BigInt(10000));

export interface OrderTotals {
  subtotalFils: number;
  /** As the backend formats it: "10.00". */
  discountPercent: string;
  discountFils: number;
  deliveryFils: number;
  totalFils: number;
}

/** Totals of priced lines; no discount and no delivery fee unless given (valid inputs only). */
export const orderTotals = (lineTotalsFils: number[], discountPercent = "0", deliveryPrice = "0"): OrderTotals => {
  const subtotalFils = lineTotalsFils.reduce((sum, lineTotal) => sum + lineTotal, 0);
  const hundredths = percentHundredths(discountPercent);
  const discount = discountFils(subtotalFils, discountPercent);
  const deliveryFils = toFils(deliveryPrice);
  return {
    subtotalFils,
    discountPercent: `${Math.trunc(hundredths / 100)}.${String(hundredths % 100).padStart(2, "0")}`,
    discountFils: discount,
    deliveryFils,
    totalFils: subtotalFils - discount + deliveryFils,
  };
};

export interface CartPricing {
  /** Per line, in cart order; null for a line the catalog no longer sells. */
  lines: (LinePrice | null)[];
  totals: OrderTotals;
  /** False when a line cannot be priced: checkout is blocked until it is removed. */
  complete: boolean;
}

/** The cart, priced with the discount and delivery fee that checkout will send. */
export const priceCart = (index: CatalogIndex, lines: LineConfig[], adjustments: { discountPercent?: string; deliveryPrice?: string } = {}): CartPricing => {
  const priced = lines.map((line) => {
    const product = index.variants.get(line.variantId)?.product;
    return product ? priceLine(product, line) : null;
  });
  return {
    lines: priced,
    totals: orderTotals(
      priced.map((line) => line?.lineTotalFils ?? 0),
      adjustments.discountPercent,
      adjustments.deliveryPrice
    ),
    complete: priced.every((line) => line !== null),
  };
};

/** Cash at the counter is compared with this amount: the total as a money string ("19.500"). */
export const totalAmount = (pricing: CartPricing) => fromFils(pricing.totals.totalFils);
