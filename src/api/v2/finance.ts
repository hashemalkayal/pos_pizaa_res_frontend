import { http, unwrap, type ApiEnvelope } from "../http";
import type { Money } from "./catalog";

/** An order count and its sales (Σ the orders' charged totals). */
export interface FinanceFigure {
  orders: number;
  sales: Money;
}

/**
 * GET /api/reports/finance/overview (backend: report.service financeOverview, ADMIN only). One range of business dates
 * (Asia/Amman, inclusive) for every figure. Eligible orders: not cancelled (status ACTIVE). Sales = Σ the recorded
 * charged totals (items with add-ons, less the order discount, plus delivery).
 */
export interface FinanceOverview {
  from: string;
  to: string;
  timeZone: string;
  totals: FinanceFigure;
  /** 24 rows, hour 0–23 of the order time in Asia/Amman, summed over every day of the range. */
  byHour: (FinanceFigure & { hour: number })[];
  /** At most 5, most sold first: quantity and item price × quantity from the order lines (add-ons not included). */
  topItems: { variantId: number; productId: number; productNameEn: string; productNameAr: string; labelEn: string | null; labelAr: string | null; quantity: number; sales: Money }[];
  /** POS orders per employee (shown by email), most sales first. */
  cashiers: (FinanceFigure & { userId: number; name: string | null })[];
  /** EXTERNAL orders (the call-center integration), with each integration client. */
  integration: FinanceFigure & { clients: (FinanceFigure & { apiClientId: number; name: string | null })[] };
  /** Orders without a recorded creator: counted in the totals only (none are expected). */
  unattributed: FinanceFigure;
}

export const getFinanceOverview = async (range: { from: string; to: string }, signal?: AbortSignal): Promise<FinanceOverview> =>
  unwrap(await http.get<ApiEnvelope<FinanceOverview>>("/reports/finance/overview", { params: range, signal }));
