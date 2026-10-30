import type { Icon } from "@tabler/icons-react";
import {
  IconCashRegister,
  IconChartBar,
  IconReceipt,
  IconReportMoney,
  IconToolsKitchen2,
  IconUsers,
} from "@tabler/icons-react";

export interface AppSection {
  id: "pos" | "orders" | "customers" | "menu" | "reports" | "finance";
  path: string;
  labelKey: string;
  icon: Icon;
  /** Shown to ADMIN only — a navigation rule, not security (D30 deferred). */
  adminOnly?: boolean;
  /** Rebuild phase that delivers this section; removed once the V2 screen exists. */
  plannedPhase?: number;
}

/** Only sections backed by a V2 API. No Settings/Users/Printers screens (no backend support). */
export const APP_SECTIONS: AppSection[] = [
  { id: "pos", path: "/pos", labelKey: "nav.pos", icon: IconCashRegister, plannedPhase: 2 },
  { id: "orders", path: "/orders", labelKey: "nav.orders", icon: IconReceipt, plannedPhase: 3 },
  { id: "customers", path: "/customers", labelKey: "nav.customers", icon: IconUsers, plannedPhase: 3 },
  // `/menu` is the public menu page, so menu management lives at `/catalog`.
  { id: "menu", path: "/catalog", labelKey: "nav.menu", icon: IconToolsKitchen2, plannedPhase: 4 },
  { id: "reports", path: "/reports", labelKey: "nav.reports", icon: IconChartBar, adminOnly: true, plannedPhase: 5 },
  { id: "finance", path: "/finance", labelKey: "nav.finance", icon: IconReportMoney, adminOnly: true, plannedPhase: 5 },
];

export const sectionsForRole = (role: string | undefined) =>
  APP_SECTIONS.filter((section) => !section.adminOnly || role === "ADMIN");

export const sectionForPath = (pathname: string) =>
  APP_SECTIONS.find((section) => pathname === section.path || pathname.startsWith(`${section.path}/`));
