import type { Customer } from "@/api/v2/customers";
import type { Order, OrderLine, OrderListItem, OrderQuote, OrderTotals, PaymentMethod } from "@/api/v2/orders";
import { MOCK_CUSTOMERS } from "./fixtures/customers";
import * as menu from "./menuStore";
import { MockError } from "./mockError";

export { MockError };

/**
 * DEVELOPMENT/TEST ONLY. In-memory orders and customers priced like the backend V2
 * (src/services/order/order-pricing.ts): lineTotal = (unitPrice + addOnsUnitPrice) × quantity,
 * discountAmount = round half up(subtotal × percent / 100, 3), total = subtotal − discount + delivery.
 * Amounts are integer fils (thousandths of a dinar), so the arithmetic is exact.
 */

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

type CustomerBody = { name: string; phone: string };

/** POST /api/customers (D79 revised): name and phone are both required. */
export const validateCustomer = (body: unknown): CustomerBody => {
  const check = new Validator();
  const value = isRecord(body) ? body : {};
  validateCustomerFields(value, check, "");
  check.throwIfInvalid();
  return value as CustomerBody;
};

/** PATCH /api/customers/:id: either field may change, but neither can be emptied. */
export const validateCustomerUpdate = (body: unknown): Partial<CustomerBody> => {
  const check = new Validator();
  const value = isRecord(body) ? body : {};
  check.keys(value, ["name", "phone"]);
  if ("name" in value) check.string(value.name, "name", 191, { required: true, min: 1 });
  if ("phone" in value) {
    check.string(value.phone, "phone", 32, { required: true, min: 3 });
    if (typeof value.phone === "string" && !PHONE.test(value.phone.trim())) check.fail("phone", "must be a phone number");
  }
  check.throwIfInvalid();
  return value as Partial<CustomerBody>;
};

// ─── Pricing ─────────────────────────────────────────────────────────────────

/** Current menu (menuStore): deleted or unavailable items are refused like the backend does. */
const priceLine = (input: LineBody): OrderLine => {
  const { variant, product, category, addOn } = menu.variantForSale(input.variantId);

  const addOnIds = input.addOnIds ?? [];
  if (new Set(addOnIds).size !== addOnIds.length) throw new MockError(422, "VALIDATION_ERROR", "An add-on is listed twice on the same line.", { addOnIds });
  const addOns = addOnIds.map(addOn);
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

/** deletedAt: soft delete (D79); a deleted customer stays in the store and on its orders. */
type MockCustomer = Customer & { deletedAt: string | null };

let customers: MockCustomer[] = [];
let orders: Order[] = [];
let nextOrderId = 1;
let nextLineId = 1;
let nextCustomerId = 1;
const dailyCounters = new Map<string, number>();

export const resetOrderStore = () => {
  customers = MOCK_CUSTOMERS.map((customer) => ({ ...customer, deletedAt: null }));
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
/** The customer as an order shows it (backend order-serializer). */
const orderCustomer = (customer: MockCustomer) => ({ id: customer.id, name: customer.name, phone: customer.phone, ...(customer.deletedAt ? { deleted: true as const } : {}) });
/** Orders read the customer when they are serialized: keep the mock orders' copies current. */
const syncOrders = (customer: MockCustomer) => {
  for (const order of orders) if (order.customer?.id === customer.id) order.customer = orderCustomer(customer);
};

/** Stored form (backend customer.service): the name with single spaces, the phone without spaces. */
const normalizeName = (name: string) => name.trim().replace(/\s+/g, " ");
const normalizePhone = (phone: string) => phone.replace(/\s+/g, "");
const activeCustomer = (id: unknown) => customers.find((candidate) => candidate.id === id && !candidate.deletedAt) ?? null;
/** D79 revised: a duplicate is the same name (any case) and phone among active customers. */
const activeByNameAndPhone = (name: string, phone: string) =>
  customers.find((candidate) => !candidate.deletedAt && candidate.name.toLowerCase() === normalizeName(name).toLowerCase() && candidate.phone === normalizePhone(phone)) ?? null;

const insertCustomer = (name: string, phone: string) => {
  const customer: MockCustomer = { id: nextCustomerId++, name: normalizeName(name), phone: normalizePhone(phone), createdAt: new Date().toISOString(), deletedAt: null };
  customers.push(customer);
  return customer;
};

export const searchCustomers = (q: string | null, pageSize: number, page = 1) => {
  const term = q?.trim().toLowerCase() ?? "";
  const matches = customers
    .filter((customer) => !customer.deletedAt)
    .filter((customer) => !term || customer.name.toLowerCase().includes(term) || customer.phone.includes(term))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
  return paginate(matches.map(withOrderCount), pageSize, page);
};

export const findCustomer = (id: number) => {
  const customer = activeCustomer(id);
  if (!customer) throw new MockError(404, "CUSTOMER_NOT_FOUND", "Customer not found.");
  return withOrderCount(customer);
};

export const createCustomer = (input: CustomerBody) => {
  const existing = activeByNameAndPhone(input.name, input.phone);
  if (existing) throw new MockError(409, "CUSTOMER_ALREADY_EXISTS", "A customer with this name and phone number already exists.", { existingCustomerId: existing.id });
  return publicCustomer(insertCustomer(input.name, input.phone));
};

/** PATCH /api/customers/:id: the sent fields change (never to empty, see validateCustomerUpdate). */
export const updateCustomer = (id: number, input: Partial<CustomerBody>) => {
  const customer = activeCustomer(id);
  if (!customer) throw new MockError(404, "CUSTOMER_NOT_FOUND", "Customer not found.");
  const name = input.name === undefined ? customer.name : normalizeName(input.name);
  const phone = input.phone === undefined ? customer.phone : normalizePhone(input.phone);
  const other = activeByNameAndPhone(name, phone);
  if (other && other.id !== id) throw new MockError(409, "CUSTOMER_ALREADY_EXISTS", "Another customer already has this name and phone number.", { existingCustomerId: other.id });
  Object.assign(customer, { name, phone });
  syncOrders(customer);
  return publicCustomer(customer);
};

/** DELETE /api/customers/:id: soft delete; the customer's orders keep it (marked deleted). */
export const deleteCustomer = (id: number) => {
  const customer = activeCustomer(id);
  if (!customer) throw new MockError(404, "CUSTOMER_NOT_FOUND", "Customer not found.");
  customer.deletedAt = new Date().toISOString();
  syncOrders(customer);
  return { id };
};

/**
 * POS order by `creator`: priced, numbered per business date and "printed" (the mocks print nothing). A different
 * `expectedTotal` → 409 PRICE_MISMATCH with the current pricing, before anything is written (D77).
 */
export const createOrder = (
  body: CreateBody,
  creator: { id: number; name: string | null; type?: "USER" | "API_CLIENT" },
  /** Creation time (tests); an API_CLIENT creator makes an EXTERNAL order, like the integration. */
  at = new Date()
): Order => {
  const priced = quote(body);
  if (!isAbsent(body.expectedTotal) && fils(String(body.expectedTotal).trim()) !== fils(priced.totalAmount)) {
    throw new MockError(409, "PRICE_MISMATCH", "The order total has changed. Check the new total and confirm again.", {
      expectedTotal: money(fils(String(body.expectedTotal).trim())),
      pricing: priced,
    });
  }
  // A deleted customer is never linked again (D79); find-or-create by name and phone looks at active customers only.
  let customer: MockCustomer | null = null;
  if (body.customerId) {
    customer = activeCustomer(body.customerId);
    if (!customer) throw new MockError(422, "CUSTOMER_NOT_FOUND", `Customer ${body.customerId} does not exist.`);
  } else if (body.customer) {
    customer = activeByNameAndPhone(body.customer.name, body.customer.phone) ?? insertCustomer(body.customer.name, body.customer.phone);
  }

  const now = at;
  const date = businessDate(now);
  const orderNumber = (dailyCounters.get(date) ?? 0) + 1;
  dailyCounters.set(date, orderNumber);
  const { items, ...orderTotals } = priced;
  const order: Order = {
    id: nextOrderId++,
    orderNumber,
    type: creator.type === "API_CLIENT" ? "EXTERNAL" : "POS",
    createdBy: { type: creator.type ?? "USER", id: creator.id, name: creator.name },
    createdAt: now.toISOString(),
    businessDate: date,
    status: "ACTIVE",
    customer: customer ? orderCustomer(customer) : null,
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

// ─── Sales report ────────────────────────────────────────────────────────────

/**
 * GET /api/reports/sales (backend report-aggregation salesRows + sales-report.service), in integer fils: ACTIVE orders
 * of the months (business dates); one row per product configuration (variant + unit + option value ids; item price ×
 * quantity) and one per add-on (add-on price × item quantity); latest names; totals and the reconciliation.
 */
export const salesReport = (fromMonth: string, toMonth: string) => {
  const eligible = orders.filter((order) => order.status === "ACTIVE" && order.businessDate.slice(0, 7) >= fromMonth && order.businessDate.slice(0, 7) <= toMonth);
  type Row = { type: "PRODUCT" | "ADDON"; key: string; productId: number | null; variantId: number | null; addOnId: number | null; nameEn: string; nameAr: string; configurationEn: string | null; configurationAr: string | null; quantity: number; fils: number };
  const rows = new Map<string, Row>();
  const add = (row: Omit<Row, "quantity" | "fils">, quantity: number, amount: number) => {
    const current = rows.get(row.key) ?? { ...row, quantity: 0, fils: 0 };
    rows.set(row.key, { ...current, ...row, quantity: current.quantity + quantity, fils: current.fils + amount });
  };
  for (const order of eligible) {
    for (const line of order.items) {
      const valueIds = line.options.map((option) => option.valueId).sort((a, b) => a - b).join(",");
      add(
        { type: "PRODUCT", key: `P:${line.variantId}:${line.unit?.id ?? 0}:${valueIds}`, productId: line.productId, variantId: line.variantId, addOnId: null, nameEn: line.productNameEn, nameAr: line.productNameAr, configurationEn: line.variantLabelEn, configurationAr: line.variantLabelAr },
        line.quantity,
        fils(line.unitPrice) * line.quantity
      );
      for (const addOn of line.addOns) {
        add(
          { type: "ADDON", key: `A:${addOn.addOnId}`, productId: null, variantId: null, addOnId: addOn.addOnId, nameEn: addOn.nameEn, nameAr: addOn.nameAr, configurationEn: null, configurationAr: null },
          line.quantity,
          fils(addOn.unitPrice) * line.quantity
        );
      }
    }
  }
  const sorted = [...rows.values()].sort(
    (a, b) =>
      (a.type === b.type ? 0 : a.type === "PRODUCT" ? -1 : 1) ||
      a.nameEn.localeCompare(b.nameEn, "en", { sensitivity: "base" }) ||
      (a.productId ?? a.addOnId ?? 0) - (b.productId ?? b.addOnId ?? 0) ||
      (a.configurationEn ?? "").localeCompare(b.configurationEn ?? "", "en")
  );
  const total = (type: Row["type"]) => {
    const list = sorted.filter((row) => row.type === type);
    return { quantity: list.reduce((n, row) => n + row.quantity, 0), fils: list.reduce((n, row) => n + row.fils, 0) };
  };
  const products = total("PRODUCT");
  const addOns = total("ADDON");
  const sum = (field: "subtotal" | "discountAmount" | "deliveryPrice" | "totalAmount") => eligible.reduce((n, order) => n + fils(order[field]), 0);
  const [year, month] = toMonth.split("-").map(Number);
  return {
    fromMonth,
    toMonth,
    from: `${fromMonth}-01`,
    to: new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10),
    timeZone: "Asia/Amman",
    rows: sorted.map(({ fils: amount, ...row }) => ({ ...row, sales: money(amount) })),
    totals: {
      orders: eligible.length,
      products: { quantity: products.quantity, sales: money(products.fils) },
      addOns: { quantity: addOns.quantity, sales: money(addOns.fils) },
      merchandise: money(products.fils + addOns.fils),
      orderDiscounts: money(sum("discountAmount")),
      deliveryFees: money(sum("deliveryPrice")),
      charged: money(sum("totalAmount")),
      reconciled: products.fils + addOns.fils === sum("subtotal"),
    },
  };
};

// ─── Finance overview ────────────────────────────────────────────────────────

const hourFormat = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: "Asia/Amman" });

/**
 * GET /api/reports/finance/overview (backend report-aggregation financeFigures), in integer fils: ACTIVE orders of the
 * business dates; sales = Σ totalAmount; hours of the creation time in Asia/Amman over every day; cashiers = USER
 * creators, integration = API_CLIENT creators; top items per variant: quantity and Σ unitPrice × quantity.
 */
export const financeOverview = (from: string, to: string) => {
  const eligible = orders.filter((order) => order.status === "ACTIVE" && order.businessDate >= from && order.businessDate <= to);
  const figure = (list: Order[]) => ({ orders: list.length, sales: money(list.reduce((sum, order) => sum + fils(order.totalAmount), 0)) });
  const groupBy = (list: Order[]) => {
    const groups = new Map<number, Order[]>();
    for (const order of list) groups.set(order.createdBy.id, [...(groups.get(order.createdBy.id) ?? []), order]);
    return [...groups.values()].map((group) => ({ id: group[0].createdBy.id, name: group[0].createdBy.name, ...figure(group) }));
  };
  const bySales = (a: { orders: number; sales: string }, b: { orders: number; sales: string }) => fils(b.sales) - fils(a.sales) || b.orders - a.orders;
  const integration = eligible.filter((order) => order.createdBy.type === "API_CLIENT");
  const items = new Map<number, { variantId: number; productId: number; productNameEn: string; productNameAr: string; labelEn: string | null; labelAr: string | null; quantity: number; fils: number }>();
  for (const order of eligible) {
    for (const line of order.items) {
      const item = items.get(line.variantId) ?? { variantId: line.variantId, productId: line.productId, productNameEn: "", productNameAr: "", labelEn: null, labelAr: null, quantity: 0, fils: 0 };
      Object.assign(item, { productNameEn: line.productNameEn, productNameAr: line.productNameAr, labelEn: line.variantLabelEn, labelAr: line.variantLabelAr });
      item.quantity += line.quantity;
      item.fils += fils(line.unitPrice) * line.quantity;
      items.set(line.variantId, item);
    }
  }
  return {
    from,
    to,
    timeZone: "Asia/Amman",
    totals: figure(eligible),
    byHour: Array.from({ length: 24 }, (_, hour) => ({ hour, ...figure(eligible.filter((order) => Number(hourFormat.format(new Date(order.createdAt))) === hour)) })),
    topItems: [...items.values()]
      .sort((a, b) => b.quantity - a.quantity || b.fils - a.fils || a.variantId - b.variantId)
      .slice(0, 5)
      .map(({ fils: amount, ...item }) => ({ ...item, sales: money(amount) })),
    cashiers: groupBy(eligible.filter((order) => order.createdBy.type === "USER"))
      .map(({ id, ...row }) => ({ userId: id, ...row }))
      .sort(bySales),
    integration: { ...figure(integration), clients: groupBy(integration).map(({ id, ...row }) => ({ apiClientId: id, ...row })).sort(bySales) },
    unattributed: { orders: 0, sales: "0.000" },
  };
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
  } else if (value.customerId !== order.customer?.id) {
    // Sending the order's own customer again changes nothing, even if it was deleted since (D79).
    const customer = activeCustomer(value.customerId);
    if (!customer) throw new MockError(422, "CUSTOMER_NOT_FOUND", `Customer ${String(value.customerId)} does not exist.`);
    order.customer = orderCustomer(customer);
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
