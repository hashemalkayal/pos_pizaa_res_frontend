import type { CatalogCategory, CatalogProduct, CatalogVariant } from "@/api/v2/catalog";
import type { Customer } from "@/api/v2/customers";
import type { Order, OrderLine, OrderListItem, OrderQuote, OrderTotals, PaymentMethod } from "@/api/v2/orders";
import { MOCK_CATALOG } from "./fixtures/catalog";
import { MOCK_CUSTOMERS } from "./fixtures/customers";

/**
 * DEVELOPMENT/TEST ONLY. In-memory orders and customers priced like the backend V2
 * (src/services/order/order-pricing.ts): lineTotal = (unitPrice + addOnsUnitPrice) × quantity,
 * discountAmount = round half up(subtotal × percent / 100, 3), total = subtotal − discount + delivery.
 * Amounts are integer fils (thousandths of a dinar), so the arithmetic is exact.
 */

/** A backend AppError (status, code, message, details). */
export class MockError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: unknown = null
  ) {
    super(message);
  }
}

type FieldError = { field: string; message: string };

const MONEY = /^\d{1,7}(\.\d{1,3})?$/;
const PERCENT = /^\d{1,3}(\.\d{1,2})?$/;
const PHONE = /^[0-9+()\- ]+$/;
const PAYMENT_METHODS: readonly PaymentMethod[] = ["CASH", "VISA", "CLIQ"];
const MAX_LINES = 50;

const fils = (money: string) => {
  const [whole, fraction = ""] = money.split(".");
  return Number(whole) * 1000 + Number(fraction.padEnd(3, "0"));
};
const money = (value: number) => `${Math.trunc(value / 1000)}.${String(value % 1000).padStart(3, "0")}`;
/** "12.5" → 1250 (hundredths of a percent). */
const hundredths = (percent: string) => {
  const [whole, fraction = ""] = percent.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isId = (value: unknown) => typeof value === "number" && Number.isInteger(value) && value > 0;
const isAbsent = (value: unknown) => value === undefined || value === null;

/** strictObject(): unknown fields → 422 FIELD_NOT_ALLOWED, anything else → 422 VALIDATION_ERROR. */
class Validator {
  readonly notAllowed: string[] = [];
  readonly errors: FieldError[] = [];

  keys(value: Record<string, unknown>, allowed: string[], path = "") {
    for (const key of Object.keys(value)) if (!allowed.includes(key)) this.notAllowed.push(path ? `${path}.${key}` : key);
  }

  fail(field: string, message: string) {
    this.errors.push({ field, message });
  }

  string(value: unknown, field: string, max: number, { required = false, min = 0 } = {}) {
    if (isAbsent(value)) {
      if (required) this.fail(field, `${field} is a required field`);
      return;
    }
    if (typeof value !== "string") return this.fail(field, `${field} must be a \`string\` type`);
    const length = value.trim().length;
    if (length < min) this.fail(field, `${field} must be at least ${min} characters`);
    if (length > max) this.fail(field, `${field} must be at most ${max} characters`);
  }

  throwIfInvalid() {
    if (this.notAllowed.length) throw new MockError(422, "FIELD_NOT_ALLOWED", "The request contains fields that are not allowed.", { fields: this.notAllowed, errors: this.errors });
    if (this.errors.length) throw new MockError(422, "VALIDATION_ERROR", "The request is invalid.", { errors: this.errors });
  }
}

interface LineBody {
  variantId: number;
  quantity: number;
  addOnIds?: number[];
  comment?: string | null;
}

interface QuoteBody {
  items: LineBody[];
  delivery?: { location?: string | null; time?: string | null; price?: string | null } | null;
  discountPercent?: string;
}

interface CreateBody extends QuoteBody {
  paymentMethod: PaymentMethod;
  customerId?: number | null;
  customer?: { name: string; phone: string } | null;
  expectedTotal?: string | null;
}

const validateQuoteFields = (body: Record<string, unknown>, check: Validator) => {
  if (!Array.isArray(body.items)) {
    check.fail("items", "items is a required field");
  } else {
    if (!body.items.length) check.fail("items", "items field must have at least 1 items");
    if (body.items.length > MAX_LINES) check.fail("items", `items field must have less than or equal to ${MAX_LINES} items`);
    body.items.forEach((item: unknown, position) => {
      const path = `items[${position}]`;
      if (!isRecord(item)) return check.fail(path, `${path} must be a \`object\` type`);
      check.keys(item, ["variantId", "quantity", "addOnIds", "comment"], path);
      if (!isId(item.variantId)) check.fail(`${path}.variantId`, `${path}.variantId must be a positive number`);
      const quantity = item.quantity;
      if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) check.fail(`${path}.quantity`, `${path}.quantity must be between 1 and 99`);
      if (item.addOnIds !== undefined && (!Array.isArray(item.addOnIds) || item.addOnIds.length > 20 || !item.addOnIds.every(isId))) {
        check.fail(`${path}.addOnIds`, `${path}.addOnIds must be at most 20 add-on ids`);
      }
      check.string(item.comment, `${path}.comment`, 500);
    });
  }
  if (!isAbsent(body.delivery)) {
    if (!isRecord(body.delivery)) {
      check.fail("delivery", "delivery must be a `object` type");
    } else {
      check.keys(body.delivery, ["location", "time", "price"], "delivery");
      check.string(body.delivery.location, "delivery.location", 500);
      check.string(body.delivery.time, "delivery.time", 50);
      if (!isAbsent(body.delivery.price) && !(typeof body.delivery.price === "string" && MONEY.test(body.delivery.price))) {
        check.fail("delivery.price", "delivery.price must be a positive amount with at most 3 decimals");
      }
    }
  }
  const percent = body.discountPercent;
  if (!isAbsent(percent) && !(PERCENT.test(String(percent).trim()) && Number(percent) <= 100)) {
    check.fail("discountPercent", "must be between 0 and 100 with at most 2 decimals");
  }
};

export const validateQuote = (body: unknown): QuoteBody => {
  const check = new Validator();
  const value = isRecord(body) ? body : {};
  check.keys(value, ["items", "delivery", "discountPercent"]);
  validateQuoteFields(value, check);
  check.throwIfInvalid();
  return value as unknown as QuoteBody;
};

const validateCustomerFields = (customer: Record<string, unknown>, check: Validator, path: string) => {
  check.keys(customer, ["name", "phone"], path);
  check.string(customer.name, `${path ? `${path}.` : ""}name`, 191, { required: true, min: 1 });
  const phoneField = `${path ? `${path}.` : ""}phone`;
  check.string(customer.phone, phoneField, 32, { required: true, min: 3 });
  if (typeof customer.phone === "string" && !PHONE.test(customer.phone.trim())) check.fail(phoneField, "must be a phone number");
};

export const validateCreate = (body: unknown): CreateBody => {
  const check = new Validator();
  const value = isRecord(body) ? body : {};
  check.keys(value, ["items", "customerId", "customer", "paymentMethod", "delivery", "discountPercent", "expectedTotal"]);
  validateQuoteFields(value, check);
  if (!PAYMENT_METHODS.includes(value.paymentMethod as PaymentMethod)) check.fail("paymentMethod", "paymentMethod must be one of the following values: CASH, VISA, CLIQ");
  if (!isAbsent(value.customerId) && !isId(value.customerId)) check.fail("customerId", "customerId must be a positive number");
  if (!isAbsent(value.customer)) {
    if (isRecord(value.customer)) validateCustomerFields(value.customer, check, "customer");
    else check.fail("customer", "customer must be a `object` type");
  }
  if (!isAbsent(value.expectedTotal) && !(typeof value.expectedTotal === "string" && MONEY.test(value.expectedTotal.trim()))) {
    check.fail("expectedTotal", "must be an amount ≥ 0 with at most 3 decimals");
  }
  if (value.customerId && value.customer) check.fail("", "send either customerId or customer, not both");
  check.throwIfInvalid();
  return value as unknown as CreateBody;
};

export const validateCustomer = (body: unknown): { name: string; phone: string } => {
  const check = new Validator();
  const value = isRecord(body) ? body : {};
  validateCustomerFields(value, check, "");
  check.throwIfInvalid();
  return value as { name: string; phone: string };
};

// ─── Pricing ─────────────────────────────────────────────────────────────────

const variantIndex = new Map<number, { variant: CatalogVariant; product: CatalogProduct; category: CatalogCategory }>(
  MOCK_CATALOG.flatMap((category) => category.products.flatMap((product) => product.variants.map((variant) => [variant.id, { variant, product, category }] as const)))
);

const priceLine = (input: LineBody): OrderLine => {
  const entry = variantIndex.get(input.variantId);
  if (!entry) throw new MockError(422, "VARIANT_NOT_FOUND", `Variant ${input.variantId} does not exist.`, { variantId: input.variantId });
  const { variant, product, category } = entry;
  if (!variant.isActive || variant.archived) throw new MockError(422, "VARIANT_UNAVAILABLE", `Variant ${input.variantId} is not available for sale.`, { variantId: input.variantId });

  const addOnIds = input.addOnIds ?? [];
  if (new Set(addOnIds).size !== addOnIds.length) throw new MockError(422, "VALIDATION_ERROR", "An add-on is listed twice on the same line.", { addOnIds });
  const addOns = addOnIds.map((addOnId) => {
    const link = product.addOns.find((candidate) => candidate.addOnId === addOnId);
    if (!link) throw new MockError(422, "ADDON_NOT_AVAILABLE", `Add-on ${addOnId} is not available for ${product.nameEn}.`, { addOnId, variantId: variant.id });
    return { addOnId, nameEn: link.nameEn, nameAr: link.nameAr, unitPrice: link.price };
  });
  const addOnsFils = addOns.reduce((sum, addOn) => sum + fils(addOn.unitPrice), 0);

  return {
    id: null,
    variantId: variant.id,
    sku: variant.sku,
    productId: product.id,
    productNameEn: product.nameEn,
    productNameAr: product.nameAr,
    categoryId: category.id,
    categoryNameEn: category.nameEn,
    categoryNameAr: category.nameAr,
    variantLabelEn: variant.labelEn,
    variantLabelAr: variant.labelAr,
    unit: variant.unit ? { id: variant.unit.id, code: variant.unit.code, nameEn: variant.unit.nameEn, nameAr: variant.unit.nameAr } : null,
    options: variant.options,
    quantity: input.quantity,
    unitPrice: variant.price,
    addOns,
    addOnsUnitPrice: money(addOnsFils),
    lineTotal: money((fils(variant.price) + addOnsFils) * input.quantity),
    comment: typeof input.comment === "string" ? input.comment.trim() : null,
  };
};

const totals = (lines: OrderLine[], discountPercent = "0", deliveryPrice = "0"): OrderTotals => {
  const subtotal = lines.reduce((sum, line) => sum + fils(line.lineTotal), 0);
  const percent = hundredths(discountPercent.trim());
  // round half up of subtotal × percent / 100, in fils: (subtotal × hundredths + 5000) / 10000
  const discount = Math.floor((subtotal * percent + 5000) / 10000);
  return {
    subtotal: money(subtotal),
    discountPercent: `${Math.trunc(percent / 100)}.${String(percent % 100).padStart(2, "0")}`,
    discountAmount: money(discount),
    deliveryPrice: money(fils(deliveryPrice)),
    totalAmount: money(subtotal - discount + fils(deliveryPrice)),
  };
};

export const quote = (body: QuoteBody): OrderQuote => {
  const items = body.items.map(priceLine);
  return { items, ...totals(items, body.discountPercent, body.delivery?.price ?? "0") };
};

// ─── Store ───────────────────────────────────────────────────────────────────

let customers: Customer[] = [];
let orders: Order[] = [];
let nextOrderId = 1;
let nextLineId = 1;
let nextCustomerId = 1;
const dailyCounters = new Map<string, number>();

export const resetOrderStore = () => {
  customers = MOCK_CUSTOMERS.map((customer) => ({ ...customer }));
  orders = [];
  nextOrderId = 1;
  nextLineId = 1;
  nextCustomerId = Math.max(0, ...customers.map((customer) => customer.id)) + 1;
  dailyCounters.clear();
};
resetOrderStore();

const businessDate = (at: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Amman" }).format(at);
const publicCustomer = ({ id, name, phone, createdAt }: Customer): Customer => ({ id, name, phone, createdAt });
const withOrderCount = (customer: Customer): Customer => ({ ...publicCustomer(customer), orderCount: orders.filter((order) => order.customer?.id === customer.id).length });

const insertCustomer = (name: string, phone: string) => {
  const customer: Customer = { id: nextCustomerId++, name: name.trim(), phone: phone.trim(), createdAt: new Date().toISOString() };
  customers.push(customer);
  return customer;
};

export const searchCustomers = (q: string | null, pageSize: number) => {
  const term = q?.trim().toLowerCase() ?? "";
  const matches = customers
    .filter((customer) => !term || customer.name.toLowerCase().includes(term) || customer.phone.includes(term))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
  return paginate(matches.map(withOrderCount), pageSize);
};

export const findCustomer = (id: number) => {
  const customer = customers.find((candidate) => candidate.id === id);
  if (!customer) throw new MockError(404, "CUSTOMER_NOT_FOUND", "Customer not found.");
  return withOrderCount(customer);
};

export const createCustomer = (input: { name: string; phone: string }) => {
  const existing = customers.find((customer) => customer.phone === input.phone.trim());
  if (existing) throw new MockError(409, "CUSTOMER_ALREADY_EXISTS", "A customer with this phone number already exists.", { existingCustomerId: existing.id });
  return publicCustomer(insertCustomer(input.name, input.phone));
};

/**
 * POS order by `creator`: priced, numbered per business date and "printed" (the mocks print nothing). A different
 * `expectedTotal` → 409 PRICE_MISMATCH with the current pricing, before anything is written (D77).
 */
export const createOrder = (body: CreateBody, creator: { id: number; name: string | null }): Order => {
  const priced = quote(body);
  if (!isAbsent(body.expectedTotal) && fils(String(body.expectedTotal).trim()) !== fils(priced.totalAmount)) {
    throw new MockError(409, "PRICE_MISMATCH", "The order total has changed. Check the new total and confirm again.", {
      expectedTotal: money(fils(String(body.expectedTotal).trim())),
      pricing: priced,
    });
  }
  let customer: Customer | null = null;
  if (body.customerId) {
    customer = customers.find((candidate) => candidate.id === body.customerId) ?? null;
    if (!customer) throw new MockError(422, "CUSTOMER_NOT_FOUND", `Customer ${body.customerId} does not exist.`);
  } else if (body.customer) {
    customer = customers.find((candidate) => candidate.phone === body.customer?.phone.trim()) ?? insertCustomer(body.customer.name, body.customer.phone);
  }

  const now = new Date();
  const date = businessDate(now);
  const orderNumber = (dailyCounters.get(date) ?? 0) + 1;
  dailyCounters.set(date, orderNumber);
  const { items, ...orderTotals } = priced;
  const order: Order = {
    id: nextOrderId++,
    orderNumber,
    type: "POS",
    createdBy: { type: "USER", id: creator.id, name: creator.name },
    createdAt: now.toISOString(),
    businessDate: date,
    status: "ACTIVE",
    customer: customer ? { id: customer.id, name: customer.name, phone: customer.phone } : null,
    paymentMethod: body.paymentMethod,
    delivery: { location: body.delivery?.location?.trim() ?? null, time: body.delivery?.time?.trim() ?? null },
    // D78: delivery details (address, time or a charge) make a delivery order.
    serviceType: body.delivery?.location?.trim() || body.delivery?.time?.trim() || fils(orderTotals.deliveryPrice) > 0 ? "DELIVERY" : "DINE_IN",
    ...orderTotals,
    items: items.map((line) => ({ ...line, id: nextLineId++ })),
    updatedBy: null,
    voidedBy: null,
    voidedAt: null,
    voidReason: null,
    version: 0,
    updatedAt: now.toISOString(),
    kitchenPrint: { status: "SENT", lastAttemptAt: now.toISOString(), errorClass: null },
  };
  orders.push(order);
  return order;
};

export const findOrder = (id: number) => {
  const order = orders.find((candidate) => candidate.id === id);
  if (!order) throw new MockError(404, "ORDER_NOT_FOUND", "Order not found.");
  return order;
};

export const listOrders = (query: {
  createdByUserId?: number;
  type?: string;
  businessDate?: string;
  orderNumber?: number;
  status?: string;
  service?: string;
  page?: number;
  pageSize: number;
}) => {
  const rows: OrderListItem[] = orders
    .filter((order) => query.createdByUserId === undefined || (order.createdBy.type === "USER" && order.createdBy.id === query.createdByUserId))
    .filter((order) => query.type === undefined || order.type === query.type)
    .filter((order) => query.businessDate === undefined || order.businessDate === query.businessDate)
    .filter((order) => query.orderNumber === undefined || order.orderNumber === query.orderNumber)
    .filter((order) => query.status === undefined || order.status === query.status)
    .filter((order) => query.service === undefined || order.serviceType === query.service)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
    .map(({ items, ...header }) => ({ ...header, itemCount: items.length }));
  return paginate(rows, query.pageSize, query.page);
};

/** Header mutations (backend assertMutable): a cancelled order never changes; a stale version is refused. */
const mutable = (id: number, version: unknown) => {
  const order = findOrder(id);
  if (order.status === "VOIDED") throw new MockError(409, "ORDER_VOIDED", "The order is voided and cannot be changed.");
  if (typeof version !== "number" || !Number.isInteger(version) || version < 0) {
    throw new MockError(422, "VALIDATION_ERROR", "The request is invalid.", { errors: [{ field: "version", message: "version is a required field" }] });
  }
  if (version !== order.version) throw new MockError(409, "ORDER_VERSION_CONFLICT", "The order was changed by someone else. Reload it and try again.", { currentVersion: order.version });
  return order;
};
const touched = (order: Order) => {
  order.version += 1;
  order.updatedAt = new Date().toISOString();
  order.updatedBy = { id: order.createdBy.id, name: order.createdBy.name ?? "" };
  return order;
};

/** PATCH /api/orders/:id with { version, customerId }: only the linked customer changes. */
export const updateOrderCustomer = (id: number, body: unknown) => {
  const value = isRecord(body) ? body : {};
  const notAllowed = Object.keys(value).filter((key) => !["version", "customerId"].includes(key));
  if (notAllowed.length) throw new MockError(422, "FIELD_NOT_ALLOWED", "The request contains fields that are not allowed.", { fields: notAllowed, errors: [] });
  const order = mutable(id, value.version);
  if (value.customerId === undefined) return order;
  if (value.customerId === null) {
    order.customer = null;
  } else {
    const customer = customers.find((candidate) => candidate.id === value.customerId);
    if (!customer) throw new MockError(422, "CUSTOMER_NOT_FOUND", `Customer ${String(value.customerId)} does not exist.`);
    order.customer = { id: customer.id, name: customer.name, phone: customer.phone };
  }
  return touched(order);
};

/** POST /api/orders/:id/void with { version, reason? }: soft and permanent. */
export const voidOrder = (id: number, body: unknown) => {
  const value = isRecord(body) ? body : {};
  const order = mutable(id, value.version);
  order.status = "VOIDED";
  order.voidedAt = new Date().toISOString();
  order.voidReason = typeof value.reason === "string" && value.reason.trim() ? value.reason.trim() : null;
  order.voidedBy = { id: order.createdBy.id, name: order.createdBy.name ?? "" };
  return touched(order);
};

/** POST /api/orders/:id/print: the mocks print nothing; a cancelled order is never reprinted. */
export const printOrder = (id: number) => {
  const order = findOrder(id);
  if (order.status === "VOIDED") throw new MockError(409, "ORDER_VOIDED", "The order is voided and cannot be printed.");
  return { printed: true, mode: "FULL" };
};

const paginate = <T>(rows: T[], pageSize: number, page = 1) => ({
  items: rows.slice((page - 1) * pageSize, page * pageSize),
  pagination: { page, pageSize, total: rows.length, totalPages: Math.max(1, Math.ceil(rows.length / pageSize)) },
});
