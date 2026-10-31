import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import { appError } from "@/mocks/handlers";
import * as store from "@/mocks/orderStore";
import { renderApp, signInAs } from "@/test/renderApp";
import { server } from "@/test/server";
import { businessToday, chartHours, hourLabel, rangeDays, sumFigures } from "./financeView";

/*
 * Finance overview (ADMIN only, Phase 7) against the MSW backend (src/mocks: the figures follow the backend's
 * financeFigures rules). "Now" is fixed at 31 Oct 2026, 12:00 in Amman (UTC+3); timers stay real.
 */

const NOW = new Date("2026-10-31T09:00:00Z");
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

type OrderBody = Parameters<typeof store.validateCreate>[0];
const CASHIER = { id: 2, name: "Mock Cashier" };
const ADMIN = { id: 1, name: "Mock Admin" };
const INTEGRATION = { id: 7, name: "callcentersystem", type: "API_CLIENT" as const };
/** An order created at `utc` (Amman = UTC+3) by `creator`. */
const order = (utc: string, creator: { id: number; name: string; type?: "USER" | "API_CLIENT" }, body: Partial<Record<string, unknown>>) =>
  store.createOrder(store.validateCreate({ paymentMethod: "CASH", ...body } as OrderBody), creator, new Date(utc));

/**
 * Today (31 Oct): cashier 10:15 Margherita M ×2 + Extra Basil = 10.000; cashier 10:40 Water = 0.500; admin 11:20
 * Water ×2 = 1.000; cashier 12:10 Soft Drink (cancelled); integration 14:05 Margherita L −10% = 4.500.
 * Yesterday (30 Oct): cashier 10:30 Margherita M = 4.000.
 */
const seed = () => {
  order("2026-10-31T07:15:00Z", CASHIER, { items: [{ variantId: 101, quantity: 2, addOnIds: [3] }] });
  order("2026-10-31T07:40:00Z", CASHIER, { items: [{ variantId: 100, quantity: 1 }] });
  order("2026-10-31T08:20:00Z", ADMIN, { items: [{ variantId: 100, quantity: 2 }] });
  const cancelled = order("2026-10-31T09:10:00Z", CASHIER, { items: [{ variantId: 99, quantity: 3 }] });
  store.voidOrder(cancelled.id, { version: 0 });
  order("2026-10-31T11:05:00Z", INTEGRATION, { items: [{ variantId: 102, quantity: 1 }], discountPercent: "10" });
  order("2026-10-30T07:30:00Z", CASHIER, { items: [{ variantId: 101, quantity: 1 }] });
};

/** Records the query string of every finance request. */
const recordRequests = () => {
  const urls: URL[] = [];
  server.use(
    http.get("*/api/reports/finance/overview", ({ request }) => {
      urls.push(new URL(request.url));
    })
  );
  return urls;
};

const openFinance = async () => {
  signInAs("ADMIN");
  renderApp("/finance");
  await screen.findByRole("heading", { level: 1, name: "Finance" }, { timeout: 5000 });
  await screen.findByRole("region", { name: "Total sales" }, { timeout: 5000 });
  return userEvent.setup({ advanceTimers: () => undefined });
};

const region = (name: string) => screen.getByRole("region", { name });
const hourRows = () => within(screen.getByRole("table", { name: "Revenue by hour" })).getAllByRole("row").slice(1).map((row) => row.textContent);
const cashierRows = () => within(region("Cashier performance")).getAllByRole("row").map((row) => [...row.querySelectorAll("th, td")].map((cell) => cell.textContent));

describe("Finance — access", () => {
  it("a cashier gets the role notice at /finance and no figures are requested", async () => {
    const requests = recordRequests();
    signInAs("CASHER");
    renderApp("/finance");
    expect(await screen.findByText("Not available for your role", undefined, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Total sales" })).not.toBeInTheDocument();
    expect(requests).toHaveLength(0);
  });

  it("an admin has the Finance section (no longer planned)", async () => {
    await openFinance();
    const link = within(screen.getByRole("navigation", { name: "Main navigation" })).getByRole("link", { name: /Finance/ });
    expect(link).toHaveAttribute("aria-current", "page");
    expect(link).not.toHaveTextContent("Soon");
  });
});

describe("Finance — today (the default range)", () => {
  it("totals exclude cancelled orders and other days; cashiers, integration and totals add up without double counting", async () => {
    seed();
    const requests = recordRequests();
    await openFinance();
    expect(requests.at(-1)!.searchParams.get("from")).toBe("2026-10-31");
    expect(requests.at(-1)!.searchParams.get("to")).toBe("2026-10-31");

    expect(region("Total sales")).toHaveTextContent("16.000 JOD");
    expect(region("Total orders")).toHaveTextContent("4");
    expect(cashierRows()).toEqual([
      ["Cashier", "Orders", "Total sales (JOD)"],
      ["cashier@mock.local", "2", "10.500"],
      ["admin@mock.local", "1", "1.000"],
      ["All cashiers", "3", "11.500"],
    ]);
    const integration = region("External integration");
    expect(integration).toHaveTextContent("Orders1");
    expect(integration).toHaveTextContent("Total sales4.500 JOD");
    expect(integration).toHaveTextContent("callcentersystem");
    // 11.500 (cashiers) + 4.500 (integration) = 16.000 (total); 3 + 1 = 4 orders.
    expect(screen.queryByText(/without a recorded creator/)).not.toBeInTheDocument();
  });

  it("revenue by hour: distinct hour labels from the first to the last hour with sales, gaps included", async () => {
    seed();
    await openFinance();
    expect(hourRows()).toEqual(["10:00–11:00210.500 JOD", "11:00–12:0011.000 JOD", "12:00–13:0000.000 JOD", "13:00–14:0000.000 JOD", "14:00–15:0014.500 JOD"]);
  });

  it("top selling items: quantity and item price × quantity from the order lines (add-ons not included)", async () => {
    seed();
    await openFinance();
    const items = within(region("Top selling items")).getAllByRole("listitem").map((item) => item.textContent);
    expect(items).toEqual(["1Water× 31.500 JOD", "2MargheritaMedium · Regular× 28.000 JOD", "3MargheritaLarge · Regular× 15.000 JOD"]);
    expect(region("Top selling items")).toHaveTextContent("Add-ons are not included.");
  });
});

describe("Finance — the date range", () => {
  it("one range for every section: 30–31 Oct adds yesterday's order everywhere (hours summed over the days)", async () => {
    seed();
    const requests = recordRequests();
    const user = await openFinance();
    await user.click(screen.getByRole("button", { name: "Dates" }));
    // Jordan's calendar week: Sunday first.
    expect((await screen.findAllByRole("columnheader")).map((header) => header.textContent).slice(0, 7)).toEqual(["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]);
    // Days of October (the calendar also shows the neighbouring months' days).
    const day = (number: number) => screen.getAllByRole("button", { name: new RegExp(`^${number}\\b`) }).find((button) => !button.hasAttribute("data-outside"))!;
    await waitFor(() => expect(day(30)).toBeDefined());
    await user.click(day(30));
    await user.click(day(31));
    await waitFor(() => expect(requests.at(-1)!.searchParams.get("from")).toBe("2026-10-30"));
    expect(requests.at(-1)!.searchParams.get("to")).toBe("2026-10-31");

    await waitFor(() => expect(region("Total sales")).toHaveTextContent("20.000 JOD"));
    expect(region("Total orders")).toHaveTextContent("5");
    expect(hourRows()[0]).toBe("10:00–11:00314.500 JOD");
    expect(cashierRows()[1]).toEqual(["cashier@mock.local", "3", "14.500"]);
    expect(within(region("Top selling items")).getAllByRole("listitem")[0]).toHaveTextContent("MargheritaMedium · Regular× 312.000 JOD");
    expect(region("External integration")).toHaveTextContent("Total sales4.500 JOD");
  });

  it("a range without orders: zero totals and an empty message in every section", async () => {
    await openFinance();
    expect(region("Total sales")).toHaveTextContent("0.000 JOD");
    expect(region("Total orders")).toHaveTextContent("0");
    expect(region("Revenue by hour")).toHaveTextContent("No sales in these dates.");
    expect(region("Top selling items")).toHaveTextContent("No items sold in these dates.");
    expect(region("Cashier performance")).toHaveTextContent("No cashier orders in these dates.");
    expect(region("External integration")).toHaveTextContent("Orders0");
  });

  it("a failed request shows the error with Try again", async () => {
    server.use(http.get("*/api/reports/finance/overview", () => appError(500, "INTERNAL_ERROR", "internal server error")));
    signInAs("ADMIN");
    renderApp("/finance");
    expect(await screen.findByRole("button", { name: "Try again" }, { timeout: 8000 })).toBeInTheDocument();
  });

  it("unattributed orders, if the backend reports any, are disclosed and not given to anyone", async () => {
    server.use(
      http.get("*/api/reports/finance/overview", () =>
        HttpResponse.json({
          response: { ...store.financeOverview("2026-10-31", "2026-10-31"), totals: { orders: 1, sales: "2.000" }, unattributed: { orders: 1, sales: "2.000" } },
          message: "Finance overview fetched.",
        })
      )
    );
    await openFinance();
    expect(screen.getByRole("status")).toHaveTextContent("Orders without a recorded creator: 1 (2.000 JOD). They are counted in the totals only.");
  });
});

describe("Finance — Arabic", () => {
  it("labels, amounts and the cashier table in Arabic, right to left", async () => {
    seed();
    await act(async () => {
      await i18n.changeLanguage("ar");
    });
    signInAs("ADMIN");
    renderApp("/finance");
    const sales = await screen.findByRole("region", { name: "إجمالي المبيعات" }, { timeout: 5000 });
    expect(document.documentElement.dir).toBe("rtl");
    expect(sales).toHaveTextContent("16.000 د.أ");
    expect(screen.getByRole("region", { name: "عدد الطلبات" })).toHaveTextContent("4");
    expect(screen.getByRole("table", { name: "الإيرادات حسب الساعة" })).toHaveTextContent("10:00–11:00");
    expect(within(screen.getByRole("region", { name: "أداء الكاشير" })).getByText("جميع الكاشير")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "التكامل الخارجي" })).toHaveTextContent("4.500 د.أ");
    expect(within(screen.getByRole("region", { name: "الأصناف الأكثر مبيعًا" })).getAllByRole("listitem")[0]).toHaveTextContent("مياه");
  });
});

describe("financeView", () => {
  it("business today in Amman, inclusive day counts, hour labels and exact sums", () => {
    expect(businessToday(new Date("2026-10-30T21:30:00Z"))).toBe("2026-10-31"); // 00:30 in Amman
    expect(rangeDays("2026-10-30", "2026-10-31")).toBe(2);
    expect(rangeDays("2025-10-31", "2026-10-31")).toBe(366);
    expect(Array.from({ length: 24 }, (_, hour) => hourLabel(hour))).toHaveLength(new Set(Array.from({ length: 24 }, (_, hour) => hourLabel(hour))).size);
    expect(hourLabel(0)).toBe("00:00");
    expect(sumFigures([{ orders: 1, sales: "0.100" }, { orders: 2, sales: "0.200" }])).toEqual({ orders: 3, sales: "0.300" });
    const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, orders: hour === 23 ? 1 : 0, sales: hour === 23 ? "1.000" : "0.000" }));
    expect(chartHours(byHour).map((row) => row.range)).toEqual(["23:00–00:00"]);
  });
});
