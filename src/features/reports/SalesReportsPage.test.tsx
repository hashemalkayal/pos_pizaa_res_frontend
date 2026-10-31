import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import { appError } from "@/mocks/handlers";
import * as menu from "@/mocks/menuStore";
import * as store from "@/mocks/orderStore";
import { renderApp, signInAs } from "@/test/renderApp";
import { server } from "@/test/server";

/*
 * Sales Reports (ADMIN only, Phase 6) against the MSW backend (src/mocks: the rows follow the backend's salesRows
 * rules). "Now" is fixed at 31 Oct 2026, 12:00 in Amman; timers stay real.
 */

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-31T09:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
});

type OrderBody = Parameters<typeof store.validateCreate>[0];
const CASHIER = { id: 2, name: "Mock Cashier" };
const order = (utc: string, body: Partial<Record<string, unknown>>) =>
  store.createOrder(store.validateCreate({ paymentMethod: "CASH", ...body } as OrderBody), CASHIER, new Date(utc));

/**
 * October: Margherita Medium · Regular ×2 + Extra Basil; Margherita Medium · Whole Wheat; Margherita Large · Regular +
 * Extra Basil + Extra Mozzarella; Penne Pesto Regular + Extra Chicken and Whole Wheat; Water ×3 with 10% off and a
 * 1.500 delivery; a cancelled order (Soft Drink ×5). September: Margherita Medium · Regular.
 */
const seed = () => {
  order("2026-10-31T07:15:00Z", { items: [{ variantId: 101, quantity: 2, addOnIds: [3] }] });
  order("2026-10-31T07:40:00Z", { items: [{ variantId: 103, quantity: 1 }] });
  order("2026-10-31T08:00:00Z", { items: [{ variantId: 102, quantity: 1, addOnIds: [3, 2] }] });
  order("2026-10-31T08:10:00Z", { items: [{ variantId: 236, quantity: 1, addOnIds: [4] }, { variantId: 237, quantity: 1 }] });
  order("2026-10-31T08:20:00Z", { items: [{ variantId: 100, quantity: 3 }], discountPercent: "10", delivery: { location: "Building 5", price: "1.500" } });
  const cancelled = order("2026-10-31T08:30:00Z", { items: [{ variantId: 99, quantity: 5 }] });
  store.voidOrder(cancelled.id, { version: 0 });
  order("2026-09-15T07:00:00Z", { items: [{ variantId: 101, quantity: 1 }] });
};

const recordRequests = (path: string) => {
  const urls: URL[] = [];
  server.use(
    http.get(path, ({ request }) => {
      urls.push(new URL(request.url));
    })
  );
  return urls;
};

const openReports = async () => {
  signInAs("ADMIN");
  renderApp("/reports");
  await screen.findByRole("heading", { level: 1, name: "Sales Reports" }, { timeout: 5000 });
  return userEvent.setup({ advanceTimers: () => undefined });
};

const table = () => screen.getByRole("table", { name: "Sales by product configuration and add-on" });
const cells = (row: HTMLElement) => [...row.querySelectorAll("td")].map((cell) => cell.textContent);
const bodyRows = () => within(table()).getAllByRole("row").filter((row) => row.closest("tbody")).map(cells);
const footRows = () => within(table()).getAllByRole("row").filter((row) => row.closest("tfoot")).map(cells);
/** Days of the open month picker in the current year (the picker shows months as buttons). */
const pickMonth = async (user: ReturnType<typeof userEvent.setup>, input: string, month: string) => {
  await user.click(screen.getByRole("button", { name: input }));
  await user.click(await screen.findByRole("button", { name: month }));
};

describe("Sales Reports — access", () => {
  it("a cashier gets the role notice at /reports; no report is requested", async () => {
    const requests = recordRequests("*/api/reports/sales");
    signInAs("CASHER");
    renderApp("/reports");
    expect(await screen.findByText("Not available for your role", undefined, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(requests).toHaveLength(0);
  });
});

describe("Sales Reports — the table", () => {
  it("current month: one row per exact configuration and per add-on; cancelled orders excluded; totals reconcile", async () => {
    seed();
    const requests = recordRequests("*/api/reports/sales");
    await openReports();
    await waitFor(() => expect(bodyRows()).toHaveLength(9));
    expect(requests.at(-1)!.searchParams.get("fromMonth")).toBe("2026-10");
    expect(requests.at(-1)!.searchParams.get("toMonth")).toBe("2026-10");
    expect(within(table()).getAllByRole("columnheader").map((header) => header.textContent)).toEqual(["Type", "Product / Add-on", "Size and options", "Quantity sold", "Sales (JOD)"]);
    expect(bodyRows()).toEqual([
      ["Product", "Margherita", "Large · Regular", "1", "5.000"],
      ["Product", "Margherita", "Medium · Regular", "2", "8.000"],
      ["Product", "Margherita", "Medium · Whole Wheat", "1", "5.000"],
      ["Product", "Penne Pesto", "Regular Penne", "1", "4.500"],
      ["Product", "Penne Pesto", "Whole Wheat Penne", "1", "5.500"],
      ["Product", "Water", "—", "3", "1.500"],
      // Extra Basil: on 2 Margheritas, then on 1 = 3 × 1.000
      ["Add-on", "Extra Basil", "—", "3", "3.000"],
      ["Add-on", "Extra Chicken", "—", "1", "1.000"],
      ["Add-on", "Extra Mozzarella", "—", "1", "1.000"],
    ]);
    // Products (add-ons excluded) + add-ons = merchandise; − order discounts + delivery = the charged total.
    expect(footRows()).toEqual([
      ["Products total", "9", "29.500"],
      ["Add-ons total", "5", "5.000"],
      ["Merchandise subtotal (products + add-ons)", "", "34.500"],
      ["Order discounts", "", "−0.150"],
      ["Delivery fees", "", "1.500"],
      ["Charged total (5 orders)", "", "35.850"],
    ]);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByText("Soft Drink")).not.toBeInTheDocument();
  });

  it("from September: the same configuration adds up across the months; a reversed range is refused without a request", async () => {
    seed();
    const requests = recordRequests("*/api/reports/sales");
    const user = await openReports();
    await waitFor(() => expect(bodyRows()).toHaveLength(9));

    await pickMonth(user, "From month", "Sep");
    await waitFor(() => expect(requests.at(-1)!.searchParams.get("fromMonth")).toBe("2026-09"));
    await waitFor(() => expect(bodyRows()[1]).toEqual(["Product", "Margherita", "Medium · Regular", "3", "12.000"]));
    expect(footRows().at(-1)).toEqual(["Charged total (6 orders)", "", "39.850"]);

    await pickMonth(user, "From month", "Oct");
    await waitFor(() => expect(bodyRows()[1]).toEqual(["Product", "Margherita", "Medium · Regular", "2", "8.000"]));
    await pickMonth(user, "To month", "Sep");
    expect(await screen.findByText("The end month is before the start month.")).toBeInTheDocument();
    expect(requests.some((url) => url.searchParams.get("fromMonth") === "2026-10" && url.searchParams.get("toMonth") === "2026-09")).toBe(false);
    expect(screen.getByRole("button", { name: "Export Excel" })).toBeDisabled();
  });

  it("20 rows per page from the server; the totals cover every page; a new month starts at page 1; the export has every row", async () => {
    seed();
    for (let index = 1; index <= 15; index += 1) {
      const product = menu.createProduct({ categoryId: 7, nameEn: `Juice ${String(index).padStart(2, "0")}`, nameAr: `عصير ${index}`, usesUnits: false });
      const variant = menu.createVariant(product.id, { price: "1.000" });
      order("2026-10-31T10:00:00Z", { items: [{ variantId: variant.id, quantity: 1 }] });
    }
    const requests = recordRequests("*/api/reports/sales");
    const exports = recordRequests("*/api/reports/sales/export");
    Object.assign(URL, { createObjectURL: vi.fn(() => "blob:sales-report"), revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const user = await openReports();

    await waitFor(() => expect(bodyRows()).toHaveLength(20));
    expect(screen.getByText("24 rows. The totals below cover every page.")).toBeInTheDocument();
    expect(requests.at(-1)!.searchParams.get("page")).toBe("1");
    expect(requests.at(-1)!.searchParams.get("pageSize")).toBe("20");
    const totals = footRows();
    expect(totals.at(-1)).toEqual(["Charged total (20 orders)", "", "50.850"]);

    await user.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() => expect(bodyRows()).toHaveLength(4));
    expect(requests.at(-1)!.searchParams.get("page")).toBe("2");
    expect(bodyRows().map((row) => row[1])).toEqual(["Water", "Extra Basil", "Extra Chicken", "Extra Mozzarella"]);
    expect(footRows()).toEqual(totals);

    await user.click(screen.getByRole("button", { name: "Export Excel" }));
    await waitFor(() => expect(exports).toHaveLength(1));
    expect([...exports[0].searchParams.keys()]).toEqual(["fromMonth", "toMonth", "lang"]);

    await pickMonth(user, "From month", "Sep");
    await waitFor(() => expect(requests.at(-1)!.searchParams.get("fromMonth")).toBe("2026-09"));
    expect(requests.at(-1)!.searchParams.get("page")).toBe("1");
  });

  it("no sales: an empty message and no export", async () => {
    await openReports();
    expect(await screen.findByText("No sales in these months.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export Excel" })).toBeDisabled();
  });

  it("a failed request shows the error with Try again", async () => {
    server.use(http.get("*/api/reports/sales", () => appError(500, "INTERNAL_ERROR", "internal server error")));
    signInAs("ADMIN");
    renderApp("/reports");
    expect(await screen.findByRole("button", { name: "Try again" }, { timeout: 8000 })).toBeInTheDocument();
  });
});

describe("Sales Reports — Export Excel", () => {
  it("downloads the .xlsx of the selected months, labelled in the page's language", async () => {
    seed();
    const exports = recordRequests("*/api/reports/sales/export");
    const createObjectURL = vi.fn(() => "blob:sales-report");
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push(`${this.download} ${this.href}`);
    });
    const user = await openReports();
    await waitFor(() => expect(bodyRows()).toHaveLength(9));

    await user.click(screen.getByRole("button", { name: "Export Excel" }));
    await waitFor(() => expect(downloads).toEqual(["sales-report_2026-10_2026-10.xlsx blob:sales-report"]));
    expect([...exports[0].searchParams.entries()]).toEqual([["fromMonth", "2026-10"], ["toMonth", "2026-10"], ["lang", "en"]]);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:sales-report");
  });
});

describe("Sales Reports — Arabic", () => {
  it("title, months (Jordanian names), headers and rows in Arabic, right to left", async () => {
    seed();
    await act(async () => {
      await i18n.changeLanguage("ar");
    });
    signInAs("ADMIN");
    renderApp("/reports");
    expect(await screen.findByRole("heading", { level: 1, name: "تقارير المبيعات" }, { timeout: 5000 })).toBeInTheDocument();
    expect(document.documentElement.dir).toBe("rtl");
    expect(screen.getByRole("button", { name: "من شهر" })).toHaveTextContent("تشرين الأول 2026");
    const arabicTable = await screen.findByRole("table", { name: "المبيعات حسب المنتج وخياراته والإضافات" });
    expect(within(arabicTable).getAllByRole("columnheader").map((header) => header.textContent)).toEqual(["النوع", "المنتج / الإضافة", "الحجم والخيارات", "الكمية المباعة", "المبيعات (دينار)"]);
    expect(cells(within(arabicTable).getAllByRole("row")[1])).toEqual(["منتج", "مارجريتا", "كبير · عادية", "1", "5.000"]);
    expect(within(arabicTable).getByText("الإجمالي المحصّل (5 طلبات)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "تصدير Excel" })).toBeEnabled();
  });
});
