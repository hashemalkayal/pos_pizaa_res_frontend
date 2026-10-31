import type { MantineColor } from "@mantine/core";
import type { Icon } from "@tabler/icons-react";
import {
  IconAddressBook,
  IconAward,
  IconBellRinging,
  IconBuildingCommunity,
  IconBuildingStore,
  IconBulb,
  IconCake,
  IconCalculator,
  IconCalendarTime,
  IconCash,
  IconChartDonut,
  IconChartLine,
  IconChartPie,
  IconChecklist,
  IconChefHat,
  IconClipboardList,
  IconClockCheck,
  IconDeviceTv,
  IconGift,
  IconHeartHandshake,
  IconLayoutGrid,
  IconMap2,
  IconMessage2,
  IconMotorbike,
  IconPackage,
  IconPackages,
  IconQrcode,
  IconRoute,
  IconScale,
  IconTarget,
  IconToolsKitchen2,
  IconTrashX,
  IconTrendingUp,
  IconTruckDelivery,
  IconWorldWww,
} from "@tabler/icons-react";

/**
 * Discover More (ADMIN only): planned capabilities that are NOT part of the POS. Marketing preview only — nothing here
 * calls the API, and every text says the capability is planned (texts: i18n `discover.*`). Titles avoid features the
 * POS already has: customers (name + phone) become "Customer Profiles", printed kitchen tickets stay, the Finance and
 * Sales Reports screens stay, and "QR Table Ordering" is ordering — the public /menu page only shows the menu.
 */

export type DiscoverCategoryId = "inventory" | "customers" | "insights" | "operations" | "delivery";

/** The illustrative miniature shown on a card (PreviewMock). Abstract shapes only: no names, numbers or prices. */
export type MockVariant =
  | "levels"
  | "alerts"
  | "breakdown"
  | "contacts"
  | "orders"
  | "hbars"
  | "profile"
  | "stamps"
  | "giftcard"
  | "messages"
  | "donut"
  | "celebration"
  | "pnl"
  | "forecast"
  | "grouped"
  | "highlights"
  | "rings"
  | "kds"
  | "floor"
  | "schedule"
  | "timeline"
  | "drawer"
  | "checklist"
  | "drivers"
  | "map"
  | "phone"
  | "qr"
  | "board"
  | "zones";

export interface DiscoverCategory {
  id: DiscoverCategoryId;
  icon: Icon;
  /** Accent of the category's icons and previews (decoration only; texts stay charcoal for contrast). */
  color: MantineColor;
}

export interface Capability {
  id: string;
  category: DiscoverCategoryId;
  icon: Icon;
  mock: MockVariant;
}

export const CATEGORIES: DiscoverCategory[] = [
  { id: "inventory", icon: IconPackages, color: "orange" },
  { id: "customers", icon: IconHeartHandshake, color: "pink" },
  { id: "insights", icon: IconChartLine, color: "indigo" },
  { id: "operations", icon: IconToolsKitchen2, color: "teal" },
  { id: "delivery", icon: IconTruckDelivery, color: "cyan" },
];

export const CAPABILITIES: Capability[] = [
  { id: "stock", category: "inventory", icon: IconPackage, mock: "levels" },
  { id: "lowStock", category: "inventory", icon: IconBellRinging, mock: "alerts" },
  { id: "recipeCosting", category: "inventory", icon: IconCalculator, mock: "breakdown" },
  { id: "suppliers", category: "inventory", icon: IconBuildingStore, mock: "contacts" },
  { id: "purchaseOrders", category: "inventory", icon: IconClipboardList, mock: "orders" },
  { id: "waste", category: "inventory", icon: IconTrashX, mock: "hbars" },

  { id: "crm", category: "customers", icon: IconAddressBook, mock: "profile" },
  { id: "loyalty", category: "customers", icon: IconAward, mock: "stamps" },
  { id: "giftCards", category: "customers", icon: IconGift, mock: "giftcard" },
  { id: "sms", category: "customers", icon: IconMessage2, mock: "messages" },
  { id: "segments", category: "customers", icon: IconChartPie, mock: "donut" },
  { id: "birthdays", category: "customers", icon: IconCake, mock: "celebration" },

  { id: "profitLoss", category: "insights", icon: IconScale, mock: "pnl" },
  { id: "foodCost", category: "insights", icon: IconChartDonut, mock: "hbars" },
  { id: "forecasting", category: "insights", icon: IconTrendingUp, mock: "forecast" },
  { id: "branches", category: "insights", icon: IconBuildingCommunity, mock: "grouped" },
  { id: "highlights", category: "insights", icon: IconBulb, mock: "highlights" },
  { id: "goals", category: "insights", icon: IconTarget, mock: "rings" },

  { id: "kds", category: "operations", icon: IconChefHat, mock: "kds" },
  { id: "tables", category: "operations", icon: IconLayoutGrid, mock: "floor" },
  { id: "scheduling", category: "operations", icon: IconCalendarTime, mock: "schedule" },
  { id: "attendance", category: "operations", icon: IconClockCheck, mock: "timeline" },
  { id: "reconciliation", category: "operations", icon: IconCash, mock: "drawer" },
  { id: "workflows", category: "operations", icon: IconChecklist, mock: "checklist" },

  { id: "drivers", category: "delivery", icon: IconMotorbike, mock: "drivers" },
  { id: "liveTracking", category: "delivery", icon: IconRoute, mock: "map" },
  { id: "website", category: "delivery", icon: IconWorldWww, mock: "phone" },
  { id: "qr", category: "delivery", icon: IconQrcode, mock: "qr" },
  { id: "statusScreen", category: "delivery", icon: IconDeviceTv, mock: "board" },
  { id: "zones", category: "delivery", icon: IconMap2, mock: "zones" },
];

/** The rich previews at the top (each has three `highlights` texts), one or two per area. */
export const FEATURED: string[] = ["recipeCosting", "profitLoss", "kds", "loyalty", "website", "liveTracking"];

export const categoryOf = (id: DiscoverCategoryId) => CATEGORIES.find((category) => category.id === id)!;
