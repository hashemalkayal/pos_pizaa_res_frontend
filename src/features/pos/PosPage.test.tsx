import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import type { CreateOrderRequest, QuoteRequest } from "@/api/v2/orders";
import { appError } from "@/mocks/handlers";
import * as store from "@/mocks/orderStore";
import { currentPathname, renderApp, signInAs } from "@/test/renderApp";
import { server } from "@/test/server";

/*
 * The cashier screen against the MSW backend (src/mocks: the V2 contract, priced like the backend).
 * Mock catalog: Margherita 101 M·Regular 4.000 / 102 L·Regular 5.000 / 103 M·Whole Wheat 5.000, add-ons
 * 1–3 at 1.000; Penne Pesto; Roast Beef folded sandwich 3.000; Soft Drink and Water 0.500.
 */

const openPos = async () => {
  signInAs("CASHER");
  renderApp("/pos");
  await screen.findByRole("button", { name: /^Margherita/ });
  return userEvent.setup();
};

const cart = () => screen.getByRole("complementary", { name: "Current order" });
const cartLines = () => within(cart()).queryAllByRole("listitem");
const checkout = () => within(cart()).getByRole("button", { name: /^Checkout/ });
const search = () => screen.getByRole("textbox", { name: "Search the menu" });
/** The product dialog's single total (footer). */
const dialogTotal = (dialog: HTMLElement) => within(dialog).getByText(/^Total/).nextSibling;
/** The amount next to a summary label (the summary is the last occurrence of the label in the cart). */
const summaryValue = (label: string) => within(cart()).getAllByText(label).at(-1)?.nextSibling;

/** Waits until the backend quote for the current cart is shown (checkout enabled with this total). */
const expectTotal = async (amount: string) => {
  await waitFor(() => expect(checkout()).toHaveAccessibleName(`Checkout · ${amount} JOD`));
  expect(checkout()).toBeEnabled();
};

const addProduct = async (user: UserEvent, name: string, configure?: (dialog: HTMLElement) => Promise<void>) => {
  await user.click(screen.getByRole("button", { name: new RegExp(`^${name}`) }));
  const dialog = await screen.findByRole("dialog", { name });
  await configure?.(dialog);
  await user.click(within(dialog).getByRole("button", { name: "Add to order" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name })).not.toBeInTheDocument());
};

/** Records the JSON bodies sent to a POST route, then lets the regular mock handle the request. */
const recordBodies = <T,>(path: "*/api/orders" | "*/api/orders/quote") => {
  const bodies: T[] = [];
  server.use(
    http.post(path, async ({ request }) => {
      bodies.push((await request.clone().json()) as T);
    })
  );
  return bodies;
};

const payWith = async (user: UserEvent, method: "Cash" | "Visa" | "CliQ", received?: string) => {
  await waitFor(() => expect(checkout()).toBeEnabled());
  await user.click(checkout());
  const dialog = await screen.findByRole("dialog", { name: "Payment" });
  if (method !== "Cash") await user.click(within(dialog).getByRole("radio", { name: method }));
  if (received !== undefined) await user.type(within(dialog).getByRole("textbox", { name: "Amount received" }), received);
  return dialog;
};

describe("POS — menu", () => {
  it("loads the menu from the backend and filters by category and by search (English and Arabic)", async () => {
    const user = await openPos();
    const categories = screen.getByRole("group", { name: "Categories" });
    // Categories with something to sell; the empty Staff Meal category is not shown.
    expect(within(categories).getAllByRole("button").map((button) => button.textContent)).toEqual(["All", "Pizza 1", "Manakish 1", "Folded Sandwiches 1", "Pasta 1", "Drinks 2"]);
    expect(screen.getByRole("button", { name: /^Margherita/ })).toHaveTextContent("from 4.000 JOD3 options");
    expect(screen.getByRole("button", { name: /^Water/ })).toHaveTextContent("0.500 JOD");

    await user.click(within(categories).getByRole("button", { name: "Drinks 2" }));
    expect(within(categories).getByRole("button", { name: "Drinks 2" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: /^Margherita/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Soft Drink/ })).toBeInTheDocument();

    // Search covers every category, whatever category is selected.
    await user.type(search(), "مارجر");
    expect(screen.getByRole("button", { name: /^Margherita/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Water/ })).not.toBeInTheDocument();

    await user.clear(search());
    await user.type(search(), "calzone");
    expect(screen.getByText("No products match “calzone”.")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Clear search" }).at(-1)!);
    expect(search()).toHaveValue("");
    expect(screen.getByRole("button", { name: /^Roast Beef Folded Sandwich with Engineers Sauce/ })).toBeInTheDocument();
  });

  it("“/” focuses the search", async () => {
    const user = await openPos();
    await user.keyboard("/");
    expect(search()).toHaveFocus();
  });
});

describe("POS — product dialog and cart", () => {
  it("customizes a product (variant, add-ons, quantity, note) with a preview, and the cart shows the backend price", async () => {
    const user = await openPos();
    const quotes = recordBodies<QuoteRequest>("*/api/orders/quote");
    await user.click(screen.getByRole("button", { name: /^Margherita/ }));
    const dialog = await screen.findByRole("dialog", { name: "Margherita" });

    // One tab per dough; the tab lists the sizes that exist for that dough.
    const doughs = within(dialog).getByRole("tablist", { name: "Dough" });
    expect(within(doughs).getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Regular", "Whole Wheat"]);
    expect(within(doughs).getByRole("tab", { name: "Regular" })).toHaveAttribute("aria-selected", "true");
    const sizes = within(dialog).getByRole("radiogroup", { name: "Size" });
    expect(within(sizes).getAllByRole("radio").map((radio) => radio.textContent)).toEqual(["Medium4.000 JOD", "Large5.000 JOD"]);
    expect(within(sizes).getByRole("radio", { name: /Medium/ })).toBeChecked();
    expect(within(dialog).getAllByRole("checkbox").map((box) => box.textContent)).toEqual(["Extra Tomato Sauce+ 1.000 JOD", "Extra Mozzarella+ 1.000 JOD", "Extra Basil+ 1.000 JOD"]);

    await user.click(within(sizes).getByRole("radio", { name: /Large/ }));
    await user.click(within(dialog).getByRole("checkbox", { name: /Extra Mozzarella/ }));
    await user.click(within(dialog).getByRole("button", { name: "Increase quantity" }));
    await user.type(within(dialog).getByRole("textbox", { name: "Item notes" }), "  cut in 8  ");
    // One total, no separate price breakdown.
    expect(within(dialog).getByText("12.000")).toBeInTheDocument(); // (5.000 + 1.000) × 2
    expect(within(dialog).getByText("Total (× 2)")).toBeInTheDocument();
    expect(within(dialog).queryByText("Price")).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Add to order" }));

    await expectTotal("12.000");
    const [line] = cartLines();
    expect(line).toHaveTextContent("Margherita");
    expect(line).toHaveTextContent("Large · Regular · + Extra Mozzarella");
    expect(line).toHaveTextContent("“cut in 8”");
    expect(line).toHaveTextContent("12.000 JOD");
    expect(within(cart()).getByText("2 items")).toBeInTheDocument();
    // Only ids, quantities and the note are sent: the backend prices the order.
    expect(quotes.at(-1)).toEqual({ items: [{ variantId: 102, quantity: 2, addOnIds: [2], comment: "cut in 8" }] });
  });

  it("switching dough keeps the size when that dough has it, else picks its first size, and keeps the add-ons", async () => {
    const user = await openPos();
    await user.click(screen.getByRole("button", { name: /^Margherita/ }));
    const dialog = await screen.findByRole("dialog", { name: "Margherita" });
    await user.click(within(dialog).getByRole("radio", { name: /Large/ }));
    await user.click(within(dialog).getByRole("checkbox", { name: /Extra Basil/ }));

    // Whole wheat comes in Medium only: Large is not offered, so Medium is selected.
    await user.click(within(dialog).getByRole("tab", { name: "Whole Wheat" }));
    expect(within(dialog).getByRole("tab", { name: "Whole Wheat" })).toHaveAttribute("aria-selected", "true");
    expect(within(dialog).getAllByRole("radio").map((radio) => radio.textContent)).toEqual(["Medium5.000 JOD"]);
    expect(within(dialog).getByRole("radio", { name: /Medium/ })).toBeChecked();
    expect(within(dialog).getByRole("checkbox", { name: /Extra Basil/ })).toBeChecked();
    expect(dialogTotal(dialog)).toHaveTextContent("6.000 JOD");

    // Back to regular: the same size (Medium) in that dough.
    await user.click(within(dialog).getByRole("tab", { name: "Regular" }));
    expect(within(dialog).getByRole("radio", { name: /Medium/ })).toBeChecked();
    expect(dialogTotal(dialog)).toHaveTextContent("5.000 JOD");

    await user.click(within(dialog).getByRole("tab", { name: "Whole Wheat" }));
    await user.click(within(dialog).getByRole("button", { name: "Add to order" }));
    await expectTotal("6.000");
    expect(cartLines()[0]).toHaveTextContent("Medium · Whole Wheat · + Extra Basil");

    // Editing reopens on the line's dough and size.
    await user.click(within(cart()).getByRole("button", { name: "Edit Margherita" }));
    const editor = await screen.findByRole("dialog", { name: "Margherita" });
    expect(within(editor).getByRole("tab", { name: "Whole Wheat" })).toHaveAttribute("aria-selected", "true");
    expect(within(editor).getByRole("radio", { name: /Medium/ })).toBeChecked();
    expect(within(editor).getByRole("checkbox", { name: /Extra Basil/ })).toBeChecked();
    expect(within(editor).getByRole("button", { name: "Update item" })).toBeInTheDocument();
  });

  it("dough tabs only for products sold in sizes: manakish and pasta keep plain option cards", async () => {
    const user = await openPos();
    await user.click(screen.getByRole("button", { name: /^Za'atar/ }));
    let dialog = await screen.findByRole("dialog", { name: "Za'atar" });
    expect(within(dialog).queryByRole("tablist")).not.toBeInTheDocument();
    const options = within(dialog).getByRole("radiogroup", { name: "Choose an option" });
    expect(within(options).getAllByRole("radio").map((radio) => radio.textContent)).toEqual(["Regular1.000 JOD", "Whole Wheat1.000 JOD"]);
    await user.click(within(options).getByRole("radio", { name: /Whole Wheat/ }));
    await user.click(within(dialog).getByRole("button", { name: "Add to order" }));
    await expectTotal("1.000");
    expect(cartLines()[0]).toHaveTextContent("Whole Wheat");

    await user.click(screen.getByRole("button", { name: /^Penne Pesto/ }));
    dialog = await screen.findByRole("dialog", { name: "Penne Pesto" });
    expect(within(dialog).queryByRole("tablist")).not.toBeInTheDocument();
    expect(within(dialog).getAllByRole("radio").map((radio) => radio.textContent)).toEqual(["Regular Penne4.500 JOD", "Whole Wheat Penne5.500 JOD"]);
  });

  it("a product with a single unlabelled variant and no add-ons opens a short dialog", async () => {
    const user = await openPos();
    await user.click(screen.getByRole("button", { name: /^Water/ }));
    const dialog = await screen.findByRole("dialog", { name: "Water" });
    expect(within(dialog).queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("checkbox")).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Add to order" })).toHaveFocus();
    await user.keyboard("{Enter}");
    await expectTotal("0.500");
  });

  it("identical lines merge; editing reopens the dialog prefilled; quantity and remove act on the right line", async () => {
    const user = await openPos();
    await addProduct(user, "Water");
    await addProduct(user, "Water");
    await addProduct(user, "Margherita", async (dialog) => user.click(within(dialog).getByRole("checkbox", { name: /Extra Basil/ })));
    await expectTotal("6.000"); // 2 × 0.500 + 4.000 + 1.000
    expect(cartLines()).toHaveLength(2);
    expect(within(cart()).getByText("2 × Water")).toBeInTheDocument();

    await user.click(within(cart()).getByRole("button", { name: "Edit Margherita" }));
    const dialog = await screen.findByRole("dialog", { name: "Margherita" });
    expect(within(dialog).getByRole("checkbox", { name: /Extra Basil/ })).toBeChecked();
    expect(within(dialog).getByRole("tab", { name: "Regular" })).toHaveAttribute("aria-selected", "true");
    expect(within(dialog).getByRole("radio", { name: /Medium/ })).toBeChecked();
    await user.click(within(dialog).getByRole("tab", { name: "Whole Wheat" }));
    await user.click(within(dialog).getByRole("button", { name: "Update item" }));
    await expectTotal("7.000");
    expect(cartLines()[1]).toHaveTextContent("Medium · Whole Wheat · + Extra Basil");

    await user.click(within(cart()).getByRole("button", { name: "One more Water" }));
    await expectTotal("7.500");
    await user.click(within(cart()).getByRole("button", { name: "One less Water" }));
    await user.click(within(cart()).getByRole("button", { name: "One less Water" }));
    await expectTotal("6.500"); // never below 1

    await user.click(within(cart()).getByRole("button", { name: "Remove Water" }));
    await expectTotal("6.000");
    expect(cartLines()).toHaveLength(1);
  });

  it("clearing the order asks for confirmation", async () => {
    const user = await openPos();
    await addProduct(user, "Water");
    await user.click(within(cart()).getByRole("button", { name: "Clear" }));
    let confirm = await screen.findByRole("dialog", { name: "Clear this order?" });
    await user.click(within(confirm).getByRole("button", { name: "Cancel" }));
    expect(cartLines()).toHaveLength(1);

    await user.click(within(cart()).getByRole("button", { name: "Clear" }));
    confirm = await screen.findByRole("dialog", { name: "Clear this order?" });
    await user.click(within(confirm).getByRole("button", { name: "Clear order" }));
    await waitFor(() => expect(cartLines()).toHaveLength(0));
    expect(within(cart()).getByText("No items yet")).toBeInTheDocument();
    expect(checkout()).toBeDisabled();
  });
});

describe("POS — order details", () => {
  it("delivery fields appear for delivery only; a dine-in order never sends them", async () => {
    const user = await openPos();
    const quotes = recordBodies<QuoteRequest>("*/api/orders/quote");
    const created = recordBodies<CreateOrderRequest>("*/api/orders");
    await addProduct(user, "Water");
    await expectTotal("0.500");
    expect(within(cart()).queryByRole("textbox", { name: /Delivery address/ })).not.toBeInTheDocument();

    await user.click(within(cart()).getByRole("radio", { name: "Delivery" }));
    expect(checkout()).toBeDisabled();
    expect(within(cart()).getByText("Enter the delivery address.")).toBeInTheDocument();
    expect(within(cart()).getByText("Enter the delivery fee (0 if free).")).toBeInTheDocument();
    await user.type(within(cart()).getByRole("textbox", { name: /Delivery address/ }), "Building 5, Street 9");
    await user.type(within(cart()).getByRole("textbox", { name: /Delivery fee/ }), "1.5");
    await expectTotal("2.000");
    expect(quotes.at(-1)).toEqual({ items: [{ variantId: 100, quantity: 1 }], delivery: { price: "1.5" } });
    expect(summaryValue("Delivery fee")).toHaveTextContent("1.500 JOD");

    // Back to dine-in: the typed address and fee stay hidden and are not sent (the dine-in price is the cached quote).
    const sentBefore = quotes.length;
    await user.click(within(cart()).getByRole("radio", { name: "Dine-in" }));
    await expectTotal("0.500");
    expect(within(cart()).queryByRole("textbox", { name: /Delivery address/ })).not.toBeInTheDocument();
    expect(quotes.slice(sentBefore).filter((quote) => "delivery" in quote)).toEqual([]);

    const dialog = await payWith(user, "Visa");
    await user.click(within(dialog).getByRole("button", { name: /^Confirm payment/ }));
    await screen.findByRole("heading", { name: "Order created" });
    expect(created).toEqual([{ items: [{ variantId: 100, quantity: 1 }], paymentMethod: "VISA" }]);
  });

  it("delivery: the fee must be a valid amount; the time picker value is sent as printed text", async () => {
    const user = await openPos();
    const created = recordBodies<CreateOrderRequest>("*/api/orders");
    await addProduct(user, "Margherita");
    await user.click(within(cart()).getByRole("radio", { name: "Delivery" }));
    await user.type(within(cart()).getByRole("textbox", { name: /Delivery address/ }), "Building 5, Street 9");

    const fee = within(cart()).getByRole("textbox", { name: /Delivery fee/ });
    await user.type(fee, "1.2345");
    expect(fee).toHaveValue("1.234"); // at most 3 decimals can be typed
    await user.clear(fee);
    await user.type(fee, "0");
    await expectTotal("4.000"); // a free delivery is a valid fee

    await user.click(within(cart()).getByRole("spinbutton", { name: "Hours" }));
    await user.keyboard("730p");
    expect(within(cart()).getByRole("spinbutton", { name: "Hours" })).toHaveValue("07");
    expect(within(cart()).getByRole("spinbutton", { name: "Minutes" })).toHaveValue("30");
    expect(within(cart()).getByRole("textbox", { name: "AM or PM" })).toHaveValue("PM");

    const dialog = await payWith(user, "Cash", "4");
    await user.click(within(dialog).getByRole("button", { name: /^Confirm payment/ }));
    await screen.findByRole("heading", { name: "Order created" });
    expect(created[0].delivery).toEqual({ location: "Building 5, Street 9", time: "7:30 PM", price: "0" });
  });

  it("a delivery time typed without AM/PM blocks checkout until it is completed or cleared", async () => {
    const user = await openPos();
    await addProduct(user, "Water");
    await user.click(within(cart()).getByRole("radio", { name: "Delivery" }));
    await user.type(within(cart()).getByRole("textbox", { name: /Delivery address/ }), "Building 5");
    await user.type(within(cart()).getByRole("textbox", { name: /Delivery fee/ }), "1");
    await expectTotal("1.500");

    await user.click(within(cart()).getByRole("spinbutton", { name: "Hours" }));
    await user.keyboard("730");
    await user.click(within(cart()).getByRole("textbox", { name: /Delivery address/ })); // leave the time fields
    expect(await within(cart()).findByText("Complete the delivery time or clear it.")).toBeInTheDocument();
    expect(checkout()).toBeDisabled();

    await user.click(within(cart()).getByRole("textbox", { name: "AM or PM" }));
    await user.keyboard("a");
    await waitFor(() => expect(within(cart()).queryByText("Complete the delivery time or clear it.")).not.toBeInTheDocument());
    await expectTotal("1.500");
  });

  it("the discount is a percentage; the backend computes the amount", async () => {
    const user = await openPos();
    await addProduct(user, "Margherita", async (dialog) => user.click(within(dialog).getByRole("radio", { name: /Large/ })));
    await addProduct(user, "Water");
    await expectTotal("5.500");

    const discount = within(cart()).getByRole("textbox", { name: /Discount/ });
    await user.type(discount, "12.5");
    await expectTotal("4.812"); // 5.500 − round half up(0.6875) = 5.500 − 0.688
    expect(summaryValue("Discount (12.5%)")).toHaveTextContent("− 0.688 JOD");

    await user.clear(discount);
    await user.type(discount, "101");
    await waitFor(() => expect(within(cart()).getByText("The discount must be 0–100% with at most 2 decimals.")).toBeInTheDocument());
    expect(checkout()).toBeDisabled();

    await user.clear(discount);
    await user.type(discount, "100");
    await expectTotal("0.000");
  });

  it("the customer is optional: search by name or phone, select, remove, create", async () => {
    const user = await openPos();
    const created = recordBodies<CreateOrderRequest>("*/api/orders");
    await addProduct(user, "Water");
    const customer = within(cart()).getByRole("textbox", { name: "Search customers" });

    await user.type(customer, "0790");
    const option = await screen.findByRole("option", { name: /Mock Customer/ });
    expect(option).toHaveTextContent("0790000001");
    await user.click(option);
    expect(within(cart()).getByText("Mock Customer")).toBeInTheDocument();
    await user.click(within(cart()).getByRole("button", { name: "Remove customer" }));
    expect(within(cart()).queryByText("Mock Customer")).not.toBeInTheDocument();

    // Keyboard: type, arrow down, Enter.
    await user.type(within(cart()).getByRole("textbox", { name: "Search customers" }), "تجريبي");
    await screen.findByRole("option", { name: /عميل تجريبي/ });
    await user.keyboard("{ArrowDown}{Enter}");
    expect(within(cart()).getByText("عميل تجريبي")).toBeInTheDocument();
    await user.click(within(cart()).getByRole("button", { name: "Remove customer" }));

    // A new customer; the name typed in the search is carried over.
    await user.type(within(cart()).getByRole("textbox", { name: "Search customers" }), "Sara");
    expect(await screen.findByText("No customer found.")).toBeInTheDocument();
    await user.click(within(cart()).getByRole("button", { name: "New customer" }));
    const dialog = await screen.findByRole("dialog", { name: "New customer" });
    expect(within(dialog).getByRole("textbox", { name: /Name/ })).toHaveValue("Sara");
    await user.click(within(dialog).getByRole("button", { name: "Save customer" }));
    expect(within(dialog).getByText("Enter a phone number (digits, +, -, spaces).")).toBeInTheDocument();
    await user.type(within(dialog).getByRole("textbox", { name: /Phone/ }), "0771234567");
    await user.click(within(dialog).getByRole("button", { name: "Save customer" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "New customer" })).not.toBeInTheDocument());
    expect(within(cart()).getByText("Sara")).toBeInTheDocument();

    const payment = await payWith(user, "CliQ");
    await user.click(within(payment).getByRole("button", { name: /^Confirm payment/ }));
    await screen.findByRole("heading", { name: "Order created" });
    expect(created[0]).toMatchObject({ customerId: 3, paymentMethod: "CLIQ" });
  });

  it("creating a customer with a phone that exists selects the existing customer", async () => {
    const user = await openPos();
    await user.click(within(cart()).getByRole("button", { name: "New customer" }));
    const dialog = await screen.findByRole("dialog", { name: "New customer" });
    await user.type(within(dialog).getByRole("textbox", { name: /Name/ }), "Someone Else");
    await user.type(within(dialog).getByRole("textbox", { name: /Phone/ }), "0790000001");
    await user.click(within(dialog).getByRole("button", { name: "Save customer" }));
    expect(await screen.findByText("This phone number already belongs to Mock Customer. That customer is selected.")).toBeInTheDocument();
    expect(within(cart()).getByText("Mock Customer")).toBeInTheDocument();
  });
});

describe("POS — prices from the backend quote", () => {
  it("a late response for an older cart never replaces the current price, and checkout waits for the current one", async () => {
    const user = await openPos();
    let releaseFirst = () => {};
    const quotes: QuoteRequest[] = [];
    server.use(
      http.post("*/api/orders/quote", async ({ request }) => {
        const body = (await request.clone().json()) as QuoteRequest;
        quotes.push(body);
        if (body.items[0].quantity === 1) await new Promise<void>((resolve) => (releaseFirst = resolve));
      })
    );

    await addProduct(user, "Water");
    await waitFor(() => expect(quotes).toHaveLength(1));
    expect(checkout()).toBeDisabled(); // no price yet

    await user.click(within(cart()).getByRole("button", { name: "One more Water" }));
    expect(checkout()).toBeDisabled();
    await expectTotal("1.000");

    await act(async () => {
      releaseFirst();
      await delay(50);
    });
    expect(checkout()).toHaveAccessibleName("Checkout · 1.000 JOD");
    expect(checkout()).toBeEnabled();
  });

  it("a refused quote is explained, blocks checkout, and can be retried", async () => {
    const user = await openPos();
    let refuse = true;
    server.use(
      http.post("*/api/orders/quote", () => {
        if (refuse) return appError(422, "ADDON_NOT_AVAILABLE", "Add-on 2 is not available for Margherita.", { addOnId: 2, variantId: 101 });
      })
    );
    await addProduct(user, "Water");
    const alert = await within(cart()).findByRole("alert");
    expect(alert).toHaveTextContent("Prices could not be calculated.");
    expect(alert).toHaveTextContent("An add-on is no longer available for one of the items.");
    expect(checkout()).toBeDisabled();

    refuse = false;
    await user.click(within(alert).getByRole("button", { name: "Try again" }));
    await expectTotal("0.500");
    expect(within(cart()).queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("POS — payment and order creation", () => {
  it("cash: change to give, and an insufficient amount blocks confirmation", async () => {
    const user = await openPos();
    await addProduct(user, "Margherita");
    await addProduct(user, "Water");
    await expectTotal("4.500");
    const dialog = await payWith(user, "Cash", "4.4");
    expect(within(dialog).getByText("The amount received is less than the total.")).toBeInTheDocument();
    expect(within(dialog).getByText("Still due").nextSibling).toHaveTextContent("0.100 JOD");
    expect(within(dialog).getByRole("button", { name: /^Confirm payment/ })).toBeDisabled();

    const received = within(dialog).getByRole("textbox", { name: "Amount received" });
    await user.clear(received);
    await user.type(received, "10");
    expect(within(dialog).getByText("Change").nextSibling).toHaveTextContent("5.500 JOD");
    expect(within(dialog).getByRole("button", { name: /^Confirm payment/ })).toBeEnabled();

    await user.click(within(dialog).getByRole("button", { name: "Exact" }));
    expect(received).toHaveValue("4.500");
    await user.click(within(dialog).getByRole("button", { name: "20.000" }));
    expect(within(dialog).getByText("Change").nextSibling).toHaveTextContent("15.500 JOD");
  });

  it("Visa and CliQ: no cash fields, no fake terminal", async () => {
    const user = await openPos();
    await addProduct(user, "Water");
    const dialog = await payWith(user, "Visa");
    expect(within(dialog).queryByRole("textbox", { name: "Amount received" })).not.toBeInTheDocument();
    expect(within(dialog).getByText("Confirm once the payment is approved on the card terminal.")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("radio", { name: "CliQ" }));
    expect(within(dialog).queryByRole("textbox", { name: "Amount received" })).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /^Confirm payment/ })).toBeEnabled();
  });

  it("confirming twice creates one order; the success dialog shows the saved number and total; New order starts over", async () => {
    const user = await openPos();
    const created = recordBodies<CreateOrderRequest>("*/api/orders");
    server.use(http.post("*/api/orders", () => delay(150)));
    await addProduct(user, "Margherita");
    await expectTotal("4.000");
    const dialog = await payWith(user, "Cash", "5");
    const confirm = within(dialog).getByRole("button", { name: /^Confirm payment/ });

    await user.dblClick(confirm);
    await user.keyboard("{Enter}");
    expect(await within(dialog).findByText("Saving the order…")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Payment" })).toBeInTheDocument();
    await user.keyboard("{Escape}"); // cannot be closed while saving
    expect(screen.getByRole("dialog", { name: "Payment" })).toBeInTheDocument();

    expect(await screen.findByRole("heading", { name: "Order created" })).toBeInTheDocument();
    expect(created).toHaveLength(1);
    expect(screen.getByText("Order #1")).toBeInTheDocument();
    expect(screen.getByText("Paid by Cash")).toBeInTheDocument();
    expect(screen.getByText("Change to give").nextSibling).toHaveTextContent("1.000 JOD");
    expect(screen.getByText("Sent to the printer.")).toBeInTheDocument();

    // The cart is kept until the cashier chooses, and the dialog does not close by itself.
    await user.keyboard("{Escape}");
    expect(screen.getByRole("heading", { name: "Order created" })).toBeInTheDocument();
    expect(cartLines()).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "New order" }));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Order created" })).not.toBeInTheDocument());
    expect(cartLines()).toHaveLength(0);
    await waitFor(() => expect(search()).toHaveFocus());
  });

  it("View order opens the saved order (read-only)", async () => {
    const user = await openPos();
    await addProduct(user, "Margherita", async (dialog) => {
      await user.click(within(dialog).getByRole("checkbox", { name: /Extra Basil/ }));
      await user.type(within(dialog).getByRole("textbox", { name: "Item notes" }), "well done");
    });
    await user.type(within(cart()).getByRole("textbox", { name: /Discount/ }), "10");
    await expectTotal("4.500");
    const dialog = await payWith(user, "Visa");
    await user.click(within(dialog).getByRole("button", { name: /^Confirm payment/ }));
    await user.click(await screen.findByRole("button", { name: "View order" }));

    expect(await screen.findByRole("heading", { name: "Order #1" })).toBeInTheDocument();
    expect(currentPathname()).toBe("/orders/1");
    const table = screen.getByRole("table");
    expect(table).toHaveTextContent("1 × Margherita");
    expect(table).toHaveTextContent("Medium · Regular · + Extra Basil");
    expect(table).toHaveTextContent("Note: well done");
    expect(screen.getByText("Discount (10%)").nextSibling).toHaveTextContent("− 0.500 JOD");
    expect(screen.getByText("Dine-in")).toBeInTheDocument();
    expect(screen.getByText("Visa")).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Back to POS" }));
    await screen.findByRole("button", { name: /^Margherita/ });
    expect(cartLines()).toHaveLength(0);
  });

  it("a refused order keeps the cart and explains why", async () => {
    const user = await openPos();
    server.use(http.post("*/api/orders", () => appError(422, "VARIANT_UNAVAILABLE", "Variant 100 is not available for sale.", { variantId: 100 })));
    await addProduct(user, "Water");
    const dialog = await payWith(user, "Visa");
    await user.click(within(dialog).getByRole("button", { name: /^Confirm payment/ }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("One of the items is not available right now. Remove it and try again.");
    await user.click(within(dialog).getByRole("button", { name: "Back" }));
    expect(cartLines()).toHaveLength(1);
    expect(screen.queryByRole("heading", { name: "Order created" })).not.toBeInTheDocument();
  });

  it("connection lost while saving: offers the order that was saved instead of creating it again", async () => {
    const user = await openPos();
    let posted = 0;
    server.use(
      http.post("*/api/orders", async ({ request }) => {
        posted += 1;
        // The backend saves the order, but the response never reaches the till.
        store.createOrder(store.validateCreate(await request.json()), { id: 2, name: "Mock Cashier" });
        return HttpResponse.error();
      })
    );
    await addProduct(user, "Water");
    const dialog = await payWith(user, "Cash", "1");
    await user.click(within(dialog).getByRole("button", { name: /^Confirm payment/ }));

    const recovery = await within(dialog).findByRole("alert");
    expect(recovery).toHaveTextContent("The connection dropped while saving");
    await within(recovery).findByText(/^Order #1 · 0\.500 JOD · /);
    await user.click(within(recovery).getByRole("button", { name: "This is the order" }));

    expect(await screen.findByRole("heading", { name: "Order created" })).toBeInTheDocument();
    expect(screen.getByText("Order #1")).toBeInTheDocument();
    expect(posted).toBe(1);
  });

  it("connection lost and nothing saved: says so and lets the cashier try again", async () => {
    const user = await openPos();
    let fail = true;
    server.use(
      http.post("*/api/orders", () => {
        if (fail) return HttpResponse.error();
      })
    );
    await addProduct(user, "Water");
    const dialog = await payWith(user, "Visa");
    await user.click(within(dialog).getByRole("button", { name: /^Confirm payment/ }));
    const recovery = await within(dialog).findByRole("alert");
    expect(await within(recovery).findByText("No order of yours from the last 10 minutes was found.")).toBeInTheDocument();

    fail = false;
    await user.click(within(dialog).getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "Order created" })).toBeInTheDocument();
  });

  it("a failed print is shown; the order is saved and not created again", async () => {
    const user = await openPos();
    let posted = 0;
    server.use(
      http.post("*/api/orders", async ({ request }) => {
        posted += 1;
        const order = store.createOrder(store.validateCreate(await request.json()), { id: 2, name: "Mock Cashier" });
        return HttpResponse.json({ response: { ...order, kitchenPrint: { status: "FAILED", lastAttemptAt: order.createdAt, errorClass: "TIMEOUT" } }, message: "Order created." }, { status: 201 });
      })
    );
    await addProduct(user, "Water");
    const dialog = await payWith(user, "Visa");
    await user.click(within(dialog).getByRole("button", { name: /^Confirm payment/ }));
    expect(await screen.findByText("Printing failed. The order is saved — do not create it again.")).toBeInTheDocument();
    expect(screen.getByText("Order #1")).toBeInTheDocument();
    expect(posted).toBe(1);
  });
});
