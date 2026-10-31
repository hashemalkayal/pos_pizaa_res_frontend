import { http, unwrap, type ApiEnvelope } from "../http";
import type { CatalogVariant, Money } from "./catalog";

/**
 * POS V2 orders (backend: src/schemas/v2/order.schema.ts, src/services/order/order-serializer.ts).
 * Prices are never sent: the server prices every line from the catalog (422 FIELD_NOT_ALLOWED otherwise).
 */
export type PaymentMethod = "CASH" | "VISA" | "CLIQ";

export interface OrderLineInput {
  variantId: number;
  /** 1–99 */
  quantity: number;
  /** Add-ons offered for the line's product (422 ADDON_NOT_AVAILABLE otherwise); at most 20. */
  addOnIds?: number[];
  comment?: string | null;
}

export interface DeliveryInput {
  location?: string | null;
  time?: string | null;
  price?: Money | null;
}

/** POST /api/orders/quote — at most 50 lines. */
export interface QuoteRequest {
  items: OrderLineInput[];
  delivery?: DeliveryInput | null;
  /** "0"–"100", at most 2 decimals. */
  discountPercent?: string;
}

/** POST /api/orders — a POS order. Send either customerId or customer, not both. */
export interface CreateOrderRequest extends QuoteRequest {
  paymentMethod: PaymentMethod;
  customerId?: number | null;
  customer?: { name: string; phone: string } | null;
  /**
   * The total shown to the cashier (D77), never used as a price. When the server total differs, nothing is
   * created: 409 PRICE_MISMATCH with `details: { expectedTotal, pricing }` (pricing: an OrderQuote).
   */
  expectedTotal?: Money;
}

/** A priced line: the product, variant, unit, options and add-ons as they were when the line was saved. */
export interface OrderLine {
  /** null in a quote (not saved yet). */
  id: number | null;
  variantId: number;
  sku: string;
  productId: number;
  productNameEn: string;
  productNameAr: string;
  categoryId: number;
  categoryNameEn: string;
  categoryNameAr: string;
  variantLabelEn: string | null;
  variantLabelAr: string | null;
  unit: { id: number; code: string; nameEn: string; nameAr: string } | null;
  options: CatalogVariant["options"];
  quantity: number;
  unitPrice: Money;
  addOns: { addOnId: number; nameEn: string; nameAr: string; unitPrice: Money }[];
  /** Sum of the add-on prices for one unit. */
  addOnsUnitPrice: Money;
  /** (unitPrice + addOnsUnitPrice) × quantity */
  lineTotal: Money;
  comment: string | null;
}

export interface OrderTotals {
  subtotal: Money;
  /** "10.00" */
  discountPercent: string;
  discountAmount: Money;
  deliveryPrice: Money;
  /** subtotal − discountAmount + deliveryPrice */
  totalAmount: Money;
}

export interface OrderQuote extends OrderTotals {
  items: OrderLine[];
}

export type OrderCreator = { type: "USER" | "API_CLIENT"; id: number; name: string | null };
export type StaffRef = { id: number; name: string } | null;

/** Print state of the latest print request (D74: POS and EXTERNAL orders print the same way). */
export interface KitchenPrint {
  status: "NONE" | "SENT" | "FAILED";
  lastAttemptAt: string | null;
  /** TIMEOUT, NETWORK, HTTP_…, AGENT_REJECTED */
  errorClass: string | null;
}

export interface Order extends OrderTotals {
  id: number;
  /** Daily number, unique per business date. */
  orderNumber: number;
  type: "POS" | "EXTERNAL";
  createdBy: OrderCreator;
  createdAt: string;
  /** YYYY-MM-DD */
  businessDate: string;
  status: "ACTIVE" | "VOIDED";
  customer: { id: number; name: string; phone: string } | null;
  paymentMethod: PaymentMethod | null;
  delivery: { location: string | null; time: string | null };
  items: OrderLine[];
  updatedBy: StaffRef;
  voidedBy: StaffRef;
  voidedAt: string | null;
  voidReason: string | null;
  /** Sent back with every change; a stale version → 409 ORDER_VERSION_CONFLICT. */
  version: number;
  updatedAt: string;
  kitchenPrint: KitchenPrint;
}

/** A list row: the order header with `itemCount` instead of `items`. */
export type OrderListItem = Omit<Order, "items"> & { itemCount: number };

export interface Page<T> {
  items: T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

/** GET /api/orders filters used by the POS (backend: orderListQuery). */
export interface OrderListQuery {
  businessDate?: string;
  createdByUserId?: number;
  type?: "POS" | "EXTERNAL";
  pageSize?: number;
}

/** Server-authoritative prices and totals for a cart (nothing is saved). The POS prices locally and does not call it. */
export const quoteOrder = async (body: QuoteRequest, signal?: AbortSignal): Promise<OrderQuote> =>
  unwrap(await http.post<ApiEnvelope<OrderQuote>>("/orders/quote", body, { signal }));

/**
 * Creates and prints a POS order (201); 409 PRICE_MISMATCH when `expectedTotal` differs from the server total. The backend has no idempotency for POS orders, so the UI must block
 * a second submit while the first is pending. A print failure never undoes the order (kitchenPrint FAILED).
 */
export const createOrder = async (body: CreateOrderRequest): Promise<Order> =>
  unwrap(await http.post<ApiEnvelope<Order>>("/orders", body));

export const getOrder = async (id: number, signal?: AbortSignal): Promise<Order> =>
  unwrap(await http.get<ApiEnvelope<Order>>(`/orders/${id}`, { signal }));

/** Newest first. */
export const listOrders = async (query: OrderListQuery, signal?: AbortSignal): Promise<Page<OrderListItem>> =>
  unwrap(await http.get<ApiEnvelope<Page<OrderListItem>>>("/orders", { params: query, signal }));
