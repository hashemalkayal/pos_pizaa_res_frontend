import type { Customer } from "@/api/v2/customers";
import type { CreateOrderRequest, DeliveryInput, OrderLineInput, PaymentMethod, QuoteRequest } from "@/api/v2/orders";
import { isMoneyInput, isPercentInput } from "@/lib/money";
import type { CartLine } from "./cart";
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
  /** 0–100, at most 2 decimals; "" means no discount. Percentage only: the server computes the amount. */
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

const lineInputs = (lines: CartLine[]): OrderLineInput[] =>
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

/** Delivery only; the fee is included once it is a valid amount (the quote updates as the cashier types). */
const deliveryOf = (draft: OrderDraft): DeliveryInput | undefined => {
  if (draft.serviceType !== "DELIVERY") return undefined;
  const fee = draft.delivery.fee.trim();
  return {
    location: draft.delivery.location.trim() || null,
    time: isTimePickerValue(draft.delivery.time) ? formatDeliveryTime(draft.delivery.time) : null,
    price: isMoneyInput(fee) ? fee : null,
  };
};

/**
 * The pricing request for the current cart, or null when there is nothing to price. Checkout uses the same
 * lines, discount and delivery fee, so a quote for exactly this request is the price of the order.
 */
export const buildQuoteRequest = (lines: CartLine[], draft: OrderDraft): QuoteRequest | null => {
  if (!lines.length) return null;
  const discountPercent = discountOf(draft);
  const delivery = deliveryOf(draft);
  return {
    items: lineInputs(lines),
    ...(discountPercent ? { discountPercent } : {}),
    ...(delivery?.price ? { delivery: { price: delivery.price } } : {}),
  };
};

/** POST /api/orders body. Dine-in never carries delivery values; the customer is optional. */
export const buildCreateOrderRequest = (lines: CartLine[], draft: OrderDraft, paymentMethod: PaymentMethod): CreateOrderRequest => {
  const discountPercent = discountOf(draft);
  const delivery = deliveryOf(draft);
  return {
    items: lineInputs(lines),
    paymentMethod,
    ...(draft.customer ? { customerId: draft.customer.id } : {}),
    ...(delivery ? { delivery } : {}),
    ...(discountPercent ? { discountPercent } : {}),
  };
};

/** Stable identity of a quote request (key of the quote query, and the check that a quote is current). */
export const quoteKey = (request: QuoteRequest | null) => (request ? JSON.stringify(request) : null);
