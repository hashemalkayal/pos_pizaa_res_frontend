import type { Icon } from "@tabler/icons-react";
import {
  IconCashRegister,
  IconChartBar,
  IconCompass,
  IconReceipt,
  IconReportMoney,
  IconToolsKitchen2,
} from "@tabler/icons-react";

export interface AppSection {
  id: "pos" | "orders" | "menu" | "reports" | "finance" | "discover";
  path: string;
  labelKey: string;
  icon: Icon;
  /** Shown to ADMIN only — a navigation rule, not security (D30 deferred). */
  adminOnly?: boolean;
}

/**
 * Sections backed by the API, plus Discover More: a preview of PLANNED modules (no API, ADMIN only). No
 * Settings/Users/Printers screens (no backend support).
 */
export const APP_SECTIONS: AppSection[] = [
  { id: "pos", path: "/pos", labelKey: "nav.pos", icon: IconCashRegister },
  { id: "orders", path: "/orders", labelKey: "nav.orders", icon: IconReceipt },
  // `/menu` is the public menu page, so menu management lives at `/catalog` (ADMIN only, D80).
  { id: "menu", path: "/catalog", labelKey: "nav.menu", icon: IconToolsKitchen2, adminOnly: true },
  { id: "reports", path: "/reports", labelKey: "nav.reports", icon: IconChartBar, adminOnly: true },
  { id: "finance", path: "/finance", labelKey: "nav.finance", icon: IconReportMoney, adminOnly: true },
  { id: "discover", path: "/discover", labelKey: "nav.discover", icon: IconCompass, adminOnly: true },
];

export const sectionsForRole = (role: string | undefined) =>
  APP_SECTIONS.filter((section) => !section.adminOnly || role === "ADMIN");

export const sectionForPath = (pathname: string) =>
  APP_SECTIONS.find((section) => pathname === section.path || pathname.startsWith(`${section.path}/`));
