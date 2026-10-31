import type { Customer } from "@/api/customers";
import type { CreateOrderRequest, DeliveryInput, OrderLineInput, PaymentMethod } from "@/api/orders";
import { isMoneyInput, isPercentInput } from "@/lib/money";
import type { LineConfig } from "./cart";
import { formatDeliveryTime, isTimePickerValue } from "./deliveryTime";

/**
 * Delivery or dine-in. The backend has no service-type field: a delivery order is one sent with `delivery`
 * (address, time, fee). Dine-in orders are sent without it, so hidden delivery values are never submitted.
 */
export type ServiceType = "DINE_IN" | "DELIVERY";

export interface OrderDraft {
  serviceType: ServiceType;
  /** Optional for both service types. */
  customer: Customer | null;
  /**
   * Delivery only. `time` is the TimePicker value ("HH:mm", "" when empty); `timeIncomplete` is set while a time
   * is partly typed (e.g. no AM/PM yet); `fee` is typed by the cashier.
   */
  delivery: { location: string; time: string; timeIncomplete: boolean; fee: string };
  /** 0–100, at most 2 decimals; "" means no discount. Percentage only: the amount follows from the subtotal. */
  discountPercent: string;
}

export const EMPTY_DRAFT: OrderDraft = {
  serviceType: "DINE_IN",
  customer: null,
  delivery: { location: "", time: "", timeIncomplete: false, fee: "" },
  discountPercent: "",
};

export const MAX_LOCATION_LENGTH = 500;

export type DraftProblem = "deliveryLocationRequired" | "deliveryFeeRequired" | "deliveryFeeInvalid" | "deliveryTimeInvalid" | "discountInvalid";

/** What prevents checkout: the draft's problems, or a cart line the catalog no longer sells. */
export type CheckoutProblem = DraftProblem | "itemUnavailable";

/** What prevents checkout, in the order the fields appear. */
export const draftProblems = (draft: OrderDraft): DraftProblem[] => {
  const problems: DraftProblem[] = [];
  if (draft.serviceType === "DELIVERY") {
    if (!draft.delivery.location.trim()) problems.push("deliveryLocationRequired");
    if (draft.delivery.timeIncomplete || (draft.delivery.time && !isTimePickerValue(draft.delivery.time))) problems.push("deliveryTimeInvalid");
    if (!draft.delivery.fee.trim()) problems.push("deliveryFeeRequired");
    else if (!isMoneyInput(draft.delivery.fee)) problems.push("deliveryFeeInvalid");
  }
  if (draft.discountPercent.trim() && !isPercentInput(draft.discountPercent)) problems.push("discountInvalid");
  return problems;
};

/** Request items: ids, quantity and note only (the backend prices every line). */
export const lineInputs = (lines: LineConfig[]): OrderLineInput[] =>
  lines.map((line) => ({
    variantId: line.variantId,
    quantity: line.quantity,
    ...(line.addOnIds.length ? { addOnIds: line.addOnIds } : {}),
    ...(line.comment ? { comment: line.comment } : {}),
  }));

/** The discount sent to the backend: omitted when empty, zero or not (yet) valid. */
const discountOf = (draft: OrderDraft): string | undefined => {
  const value = draft.discountPercent.trim();
  return value && isPercentInput(value) && Number(value) > 0 ? value : undefined;
};

/** Delivery only; the fee counts once it is a valid amount (the totals update as the cashier types). */
const deliveryOf = (draft: OrderDraft): DeliveryInput | undefined => {
  if (draft.serviceType !== "DELIVERY") return undefined;
  const fee = draft.delivery.fee.trim();
  return {
    location: draft.delivery.location.trim() || null,
    time: isTimePickerValue(draft.delivery.time) ? formatDeliveryTime(draft.delivery.time) : null,
    price: isMoneyInput(fee) ? fee : null,
  };
};

/** The discount and delivery fee that count for the price: exactly what checkout sends (valid values only). */
export const pricingAdjustments = (draft: OrderDraft): { discountPercent?: string; deliveryPrice?: string } => {
  const discountPercent = discountOf(draft);
  const deliveryPrice = deliveryOf(draft)?.price;
  return { ...(discountPercent ? { discountPercent } : {}), ...(deliveryPrice ? { deliveryPrice } : {}) };
};

/**
 * POST /api/orders body. Dine-in never carries delivery values; the customer is optional. `expectedTotal` is the
 * total shown to the cashier (local pricing): the backend refuses the order if its own total differs (D77).
 */
export const buildCreateOrderRequest = (lines: LineConfig[], draft: OrderDraft, paymentMethod: PaymentMethod, expectedTotal: string): CreateOrderRequest => {
  const discountPercent = discountOf(draft);
  const delivery = deliveryOf(draft);
  return {
    items: lineInputs(lines),
    paymentMethod,
    ...(draft.customer ? { customerId: draft.customer.id } : {}),
    ...(delivery ? { delivery } : {}),
    ...(discountPercent ? { discountPercent } : {}),
    expectedTotal,
  };
};
