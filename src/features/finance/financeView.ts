import type { FinanceFigure, FinanceOverview } from "@/api/finance";
import { fromFils, toFils } from "@/lib/money";

/** Like every report (backend resolveRange): at most 366 days. */
export const MAX_RANGE_DAYS = 366;

/** Today's business date (YYYY-MM-DD) in the restaurant's time zone: the default range is today. */
export const businessToday = (now = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Amman" }).format(now);

/** Days of an inclusive YYYY-MM-DD range. */
export const rangeDays = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;

/** "09:00" (24-hour clock, Latin digits in both languages). */
export const hourLabel = (hour: number) => `${String(hour).padStart(2, "0")}:00`;

export interface HourRow extends FinanceFigure {
  hour: number;
  /** Axis label: "14:00". */
  label: string;
  /** "14:00–15:00" */
  range: string;
  /** Bar height only (display); the exact amount is `sales`. */
  value: number;
}

/** The hours from the first to the last one with orders, every hour in between included (so gaps show); none when nothing sold. */
export const chartHours = (byHour: FinanceOverview["byHour"]): HourRow[] => {
  const first = byHour.findIndex((row) => row.orders > 0);
  if (first < 0) return [];
  const last = byHour.length - 1 - [...byHour].reverse().findIndex((row) => row.orders > 0);
  return byHour.slice(first, last + 1).map((row) => ({
    ...row,
    label: hourLabel(row.hour),
    range: `${hourLabel(row.hour)}–${hourLabel((row.hour + 1) % 24)}`,
    value: toFils(row.sales) / 1000,
  }));
};

/** Exact sum of figures (integer fils). */
export const sumFigures = (rows: FinanceFigure[]): FinanceFigure => ({
  orders: rows.reduce((count, row) => count + row.orders, 0),
  sales: fromFils(rows.reduce((fils, row) => fils + toFils(row.sales), 0)),
});
