import { http, unwrap, type ApiEnvelope } from "../http";
import type { Money } from "./catalog";

/** A product configuration or an add-on, with what it sold in the months. */
export interface SalesRow {
  type: "PRODUCT" | "ADDON";
  /** Grouping identity (canonical ids), unique in the report. */
  key: string;
  productId: number | null;
  variantId: number | null;
  addOnId: number | null;
  nameEn: string;
  nameAr: string;
  /** Size and options, e.g. "Small · Whole Wheat"; null for add-ons and products without any. */
  configurationEn: string | null;
  configurationAr: string | null;
  quantity: number;
  /** Products: Σ item price × quantity (add-ons excluded). Add-ons: Σ add-on price × item quantity. */
  sales: Money;
}

/**
 * GET /api/reports/sales (backend: sales-report.service, ADMIN only): not-cancelled orders of inclusive months
 * (business dates, Asia/Amman), one page of rows; the totals are those of every row.
 * products + add-ons = merchandise; merchandise − orderDiscounts + deliveryFees = charged.
 */
export interface SalesReport {
  fromMonth: string;
  toMonth: string;
  from: string;
  to: string;
  timeZone: string;
  /** The rows of the requested page. */
  rows: SalesRow[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  totals: {
    orders: number;
    products: { quantity: number; sales: Money };
    addOns: { quantity: number; sales: Money };
    merchandise: Money;
    orderDiscounts: Money;
    deliveryFees: Money;
    charged: Money;
    /** Merchandise equals the orders' recorded subtotals. */
    reconciled: boolean;
  };
}

export interface MonthRange {
  /** YYYY-MM */
  fromMonth: string;
  toMonth: string;
}

export const getSalesReport = async (query: MonthRange & { page: number; pageSize: number }, signal?: AbortSignal): Promise<SalesReport> =>
  unwrap(await http.get<ApiEnvelope<SalesReport>>("/reports/sales", { params: query, signal }));

/** GET /api/reports/sales/export: the same report as a one-sheet .xlsx with every row, labels in `lang`. */
export const downloadSalesReport = async (range: MonthRange & { lang: "en" | "ar" }): Promise<Blob> =>
  (await http.get<Blob>("/reports/sales/export", { params: range, responseType: "blob" })).data;
