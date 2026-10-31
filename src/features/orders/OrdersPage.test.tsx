import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { appError } from "@/mocks/handlers";
import * as store from "@/mocks/orderStore";
import { currentPathname, renderApp, signInAs } from "@/test/renderApp";
import { server } from "@/test/server";

/*
 * The Orders tab against the MSW backend (src/mocks: the V2 contract). Orders are created in the mock store with
 * the same rules as the backend; mock customers: #1 "Mock Customer", #2 "عميل تجريبي".
 */

type OrderBody = Parameters<typeof store.validateCreate>[0];
const createOrder = (body: Partial<Record<string, unknown>> = {}) =>
  store.createOrder(store.validateCreate({ items: [{ variantId: 101, quantity: 1 }], paymentMethod: "CASH", ...body } as OrderBody), { id: 2, name: "Mock Cashier" });

const openOrders = async (path = "/orders") => {
  signInAs("CASHER");
  renderApp(path);
  await screen.findByRole("heading", { level: 1, name: "Orders" });
  return userEvent.setup();
};

const cards = () => screen.queryAllByRole("button", { name: /^#\d+/ });
const cardNumbers = () => cards().map((card) => card.textContent?.match(/^#(\d+)/)?.[1]);
const card = (number: number) => screen.getByRole("button", { name: new RegExp(`^#${number}\\b`) });
const drawer = (number: number) => screen.findByRole("dialog", { name: new RegExp(`^Order #${number}\\b`) }, { timeout: 5000 });

/** Records the query string of every GET /api/orders. */
const recordListRequests = () => {
  const urls: URL[] = [];
  server.use(
    http.get("*/api/orders", ({ request }) => {
      urls.push(new URL(request.url));
    })
  );
  return urls;
};

describe("Orders — list", () => {
  it("shows every order newest first as cards (10 per page) with its key facts; pagination moves through the rest", async () => {
    for (let index = 0; index < 11; index += 1) createOrder();
    const delivery = createOrder({ customerId: 1, paymentMethod: "VISA", delivery: { location: "Building 5", price: "1.500" } });
    store.voidOrder(1, { version: 0 });
    const user = await openOrders();

    await waitFor(() => expect(cards()).toHaveLength(10));
    expect(screen.getByText("12 orders")).toBeInTheDocument();
    expect(cardNumbers()).toEqual(["12", "11", "10", "9", "8", "7", "6", "5", "4", "3"]);

    const newest = card(delivery.orderNumber);
    expect(newest).toHaveTextContent("Mock Customer");
    expect(newest).toHaveTextContent("Delivery");
    expect(newest).toHaveTextContent("Visa");
    expect(newest).toHaveTextContent("Active");
    expect(newest).toHaveTextContent("5.500 JOD");
    expect(within(newest).queryAllByRole("button")).toHaveLength(0); // no actions on a card
    expect(card(3)).toHaveTextContent("No customer");
    expect(card(3)).toHaveTextContent("Dine-in");
    expect(card(3)).toHaveTextContent("Cash");

    await user.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() => expect(cardNumbers()).toEqual(["2", "1"]));
    expect(card(1)).toHaveTextContent("Cancelled"); // cancelled orders stay in the list
  });

  it("searches by order number only, and every search starts at page 1", async () => {
    for (let index = 0; index < 12; index += 1) createOrder({ customerId: 1 });
    const requests = recordListRequests();
    const user = await openOrders();
    await waitFor(() => expect(cards()).toHaveLength(10));
    await user.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() => expect(cardNumbers()).toEqual(["2", "1"]));

    const search = screen.getByRole("textbox", { name: "Search by order number" });
    await user.type(search, "3");
    await waitFor(() => expect(cardNumbers()).toEqual(["3"]));
    const last = requests.at(-1)!;
    expect(last.searchParams.get("orderNumber")).toBe("3");
    expect(last.searchParams.get("page")).toBe("1");
    expect(last.searchParams.get("q")).toBeNull();

    // Names and phone numbers are not searched: only digits can be typed.
    await user.clear(search);
    await user.type(search, "Mock");
    expect(search).toHaveValue("");
    await waitFor(() => expect(cards()).toHaveLength(10));
  });

  it("filters by status, order type and date; each change starts at page 1", async () => {
    for (let index = 0; index < 11; index += 1) createOrder();
    createOrder({ delivery: { location: "Building 5", price: "1" } });
    store.voidOrder(2, { version: 0 });
    const requests = recordListRequests();
    const user = await openOrders();
    await waitFor(() => expect(cards()).toHaveLength(10));
    await user.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() => expect(cardNumbers()).toEqual(["2", "1"]));

    await user.click(screen.getByRole("textbox", { name: "Status" }));
    await user.click(await screen.findByRole("option", { name: "Cancelled" }));
    await waitFor(() => expect(cardNumbers()).toEqual(["2"]));
    expect(requests.at(-1)!.searchParams.get("status")).toBe("VOIDED");
    expect(requests.at(-1)!.searchParams.get("page")).toBe("1");

    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    await user.click(screen.getByRole("radio", { name: "Delivery" }));
    await waitFor(() => expect(cardNumbers()).toEqual(["12"]));
    expect(requests.at(-1)!.searchParams.get("service")).toBe("DELIVERY");
    await user.click(screen.getByRole("radio", { name: "Dine-in" }));
    await waitFor(() => expect(cards()).toHaveLength(10));
    expect(requests.at(-1)!.searchParams.get("service")).toBe("DINE_IN");

    await user.click(screen.getByRole("button", { name: "Date" }));
    await user.click(await screen.findByRole("button", { name: /^15\b/ }));
    await waitFor(() => expect(requests.at(-1)!.searchParams.get("businessDate")).toMatch(/^\d{4}-\d{2}-15$/));
    expect(requests.at(-1)!.searchParams.get("page")).toBe("1");
  });

  it("empty and error states", async () => {
    let fail = true;
    server.use(
      http.get("*/api/orders", () => {
        if (fail) return HttpResponse.json({ message: "internal server error", statusCode: 500 }, { status: 500 });
      })
    );
    const user = await openOrders();
    // A failed read is retried once (about 1 s) before the error is shown.
    const retry = await screen.findByRole("button", { name: "Try again" }, { timeout: 4000 });
    fail = false;
    await user.click(retry);
    expect(await screen.findByText("No orders yet.")).toBeInTheDocument();
  });
});

describe("Orders — drawer", () => {
  it("shows the saved order: details, delivery, items with options, add-ons and notes, and its totals", async () => {
    const order = createOrder({
      items: [{ variantId: 102, quantity: 2, addOnIds: [3], comment: "well done" }, { variantId: 100, quantity: 1 }],
      paymentMethod: "VISA",
      customerId: 1,
      discountPercent: "10",
      delivery: { location: "Building 5, Street 9", time: "7:30 PM", price: "1.500" },
    });
    const user = await openOrders();
    await user.click(await screen.findByRole("button", { name: /^#1\b/ }));
    const panel = await drawer(order.orderNumber);
    expect(currentPathname()).toBe(`/orders/${order.id}`);

    expect(panel).toHaveTextContent("Delivery");
    expect(panel).toHaveTextContent("Active");
    expect(panel).toHaveTextContent("Visa");
    expect(panel).toHaveTextContent("Building 5, Street 9");
    expect(panel).toHaveTextContent("7:30 PM");
    expect(within(panel).getByText("Mock Customer")).toBeInTheDocument();
    const items = within(panel).getByRole("region", { name: "Items" });
    expect(items).toHaveTextContent("2 × Margherita");
    expect(items).toHaveTextContent("Large · Regular · + Extra Basil");
    expect(items).toHaveTextContent("Note: well done");
    expect(items).toHaveTextContent("12.000 JOD");
    expect(items).toHaveTextContent("1 × Water");
    expect(within(panel).getByText("Items subtotal").nextSibling).toHaveTextContent("12.500 JOD");
    expect(within(panel).getByText("Discount (10%)").nextSibling).toHaveTextContent("− 1.250 JOD");
    expect(within(panel).getByText("Delivery fee").nextSibling).toHaveTextContent("1.500 JOD");
    expect(within(panel).getByText("Total").nextSibling).toHaveTextContent("12.750 JOD");

    await user.click(within(panel).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(currentPathname()).toBe("/orders"));
  });

  it("opens directly from /orders/:id (the POS “View order” link)", async () => {
    const order = createOrder();
    await openOrders(`/orders/${order.id}`);
    expect(await drawer(order.orderNumber)).toBeInTheDocument();
  });

  it("customer: changing or removing it is staged, saved only with Save changes; closing discards it; nothing else changes", async () => {
    const order = createOrder({ customerId: 1, paymentMethod: "CLIQ" });
    const patches: unknown[] = [];
    server.use(
      http.patch("*/api/orders/:id", async ({ request }) => {
        patches.push(await request.clone().json());
      })
    );
    const user = await openOrders();
    await user.click(await screen.findByRole("button", { name: /^#1\b/ }));
    let panel = await drawer(1);
    expect(within(panel).queryByRole("button", { name: "New customer" })).not.toBeInTheDocument();

    // Remove, then close without saving: nothing is sent and the customer is still linked.
    await user.click(within(panel).getByRole("button", { name: "Remove customer" }));
    expect(within(panel).getByText("Customer change not saved yet.")).toBeInTheDocument();
    await user.click(within(panel).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(currentPathname()).toBe("/orders"));
    await user.click(card(1));
    panel = await drawer(1);
    expect(within(panel).getByText("Mock Customer")).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Save changes" })).toBeDisabled();

    // Replace with another existing customer.
    await user.click(within(panel).getByRole("button", { name: "Change customer" }));
    await user.type(within(panel).getByRole("textbox", { name: "Search customers" }), "تجريبي");
    await user.click(await screen.findByRole("option", { name: /عميل تجريبي/ }));
    await user.click(within(panel).getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Customer updated.")).toBeInTheDocument();
    expect(patches).toEqual([{ version: 0, customerId: 2 }]);
    await waitFor(() => expect(card(1)).toHaveTextContent("عميل تجريبي"));

    // Clear the link.
    await user.click(within(panel).getByRole("button", { name: "Remove customer" }));
    await user.click(within(panel).getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(patches).toEqual([{ version: 0, customerId: 2 }, { version: 1, customerId: null }]));
    await waitFor(() => expect(card(1)).toHaveTextContent("No customer"));

    const saved = store.findOrder(order.id);
    expect([saved.totalAmount, saved.paymentMethod, saved.status, saved.items.length]).toEqual([order.totalAmount, "CLIQ", "ACTIVE", 1]);
  });

  it("cancel: confirmation with an optional reason; the order stays listed, read-only, with no reason or time shown", async () => {
    const order = createOrder({ customerId: 1 });
    const voids: unknown[] = [];
    server.use(
      http.post("*/api/orders/:id/void", async ({ request }) => {
        voids.push(await request.clone().json());
      })
    );
    const user = await openOrders();
    await user.click(await screen.findByRole("button", { name: /^#1\b/ }));
    const panel = await drawer(1);

    await user.click(within(panel).getByRole("button", { name: "Cancel order" }));
    let confirm = await screen.findByRole("dialog", { name: "Cancel order #1?" });
    await user.click(within(confirm).getByRole("button", { name: "Keep order" }));
    expect(voids).toEqual([]);

    await user.click(within(panel).getByRole("button", { name: "Cancel order" }));
    confirm = await screen.findByRole("dialog", { name: "Cancel order #1?" });
    await user.type(within(confirm).getByRole("textbox", { name: "Reason (optional)" }), "Customer left");
    await user.click(within(confirm).getByRole("button", { name: "Cancel order" }));
    expect(await screen.findByText("Order #1 cancelled.")).toBeInTheDocument();
    expect(voids).toEqual([{ version: 0, reason: "Customer left" }]);

    await waitFor(() => expect(within(panel).getByText("This order is cancelled. It can no longer be changed or reprinted.")).toBeInTheDocument());
    expect(within(panel).getAllByText("Cancelled").length).toBeGreaterThan(0);
    for (const action of ["Reprint", "Cancel order", "Save changes", "Remove customer", "Change customer"]) {
      expect(within(panel).queryByRole("button", { name: action })).not.toBeInTheDocument();
    }
    expect(panel).not.toHaveTextContent("Customer left");
    expect(within(panel).getByRole("region", { name: "Customer" })).toHaveTextContent("Mock Customer · 0790000001");
    await waitFor(() => expect(card(1)).toHaveTextContent("Cancelled"));
    expect(store.findOrder(order.id).status).toBe("VOIDED");
    expect(store.findOrder(order.id).totalAmount).toBe(order.totalAmount);
  });

  it("reprint sends the saved order to the printer; a printer failure is explained and changes nothing", async () => {
    const order = createOrder();
    let printerDown = false;
    const prints: string[] = [];
    server.use(
      http.post("*/api/orders/:id/print", ({ params }) => {
        prints.push(String(params.id));
        if (printerDown) return appError(502, "PRINT_FAILED", "The print agent did not confirm the print.", { mode: "FULL", errorClass: "TIMEOUT" });
      })
    );
    const user = await openOrders();
    await user.click(await screen.findByRole("button", { name: /^#1\b/ }));
    const panel = await drawer(1);

    await user.click(within(panel).getByRole("button", { name: "Reprint" }));
    expect(await screen.findByText("Sent to the printer.")).toBeInTheDocument();
    printerDown = true;
    await user.click(within(panel).getByRole("button", { name: "Reprint" }));
    expect(await within(panel).findByRole("alert")).toHaveTextContent("The printer did not confirm the print. Check the printer and try again.");
    expect(prints).toEqual([String(order.id), String(order.id)]);
    expect(store.findOrder(order.id).version).toBe(0);
    expect(store.listOrders({ pageSize: 50 }).items).toHaveLength(1); // no new order
  });

  it("an order cancelled elsewhere is not reprinted or changed: the server refuses and the drawer shows it read-only", async () => {
    createOrder();
    const user = await openOrders();
    await user.click(await screen.findByRole("button", { name: /^#1\b/ }));
    const panel = await drawer(1);
    store.voidOrder(1, { version: 0 }); // another till cancels it

    await user.click(within(panel).getByRole("button", { name: "Reprint" }));
    expect(await within(panel).findByRole("alert")).toHaveTextContent("This order has been cancelled. It is shown as it is now.");
    await waitFor(() => expect(within(panel).queryByRole("button", { name: "Reprint" })).not.toBeInTheDocument());
    expect(within(panel).getByText("This order is cancelled. It can no longer be changed or reprinted.")).toBeInTheDocument();
  });

  it("a customer change saved against an order changed elsewhere is refused (version) and the order is reloaded", async () => {
    createOrder({ customerId: 1 });
    const user = await openOrders();
    await user.click(await screen.findByRole("button", { name: /^#1\b/ }));
    const panel = await drawer(1);
    store.updateOrderCustomer(1, { version: 0, customerId: 2 }); // edited elsewhere: version 1

    await user.click(within(panel).getByRole("button", { name: "Remove customer" }));
    await user.click(within(panel).getByRole("button", { name: "Save changes" }));
    expect(await within(panel).findByRole("alert")).toHaveTextContent("This order was changed elsewhere. It has been reloaded — check it and try again.");
    await waitFor(() => expect(within(panel).getByText("عميل تجريبي")).toBeInTheDocument());
  });

  it("Arabic: labels, statuses and amounts in the right-to-left layout", async () => {
    createOrder({ customerId: 2 });
    store.voidOrder(1, { version: 0 });
    await act(async () => {
      await i18n.changeLanguage("ar");
    });
    signInAs("CASHER");
    renderApp("/orders/1");
    const panel = await screen.findByRole("dialog", { name: /^الطلب رقم 1/ }, { timeout: 5000 });
    expect(document.documentElement.dir).toBe("rtl");
    expect(panel).toHaveTextContent("ملغي");
    expect(panel).toHaveTextContent("هذا الطلب ملغي. لا يمكن تعديله أو إعادة طباعته.");
    expect(panel).toHaveTextContent("4.000");
    expect(screen.getByRole("textbox", { name: "البحث برقم الطلب" })).toBeInTheDocument();
  });
});
