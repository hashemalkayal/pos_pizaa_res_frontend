import { screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { rem } from "@mantine/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CatalogCategory } from "@/api/v2/catalog";
import type { CreateOrderRequest } from "@/api/v2/orders";
import { MOCK_CATALOG } from "@/mocks/fixtures/catalog";
import { appError } from "@/mocks/handlers";
import * as store from "@/mocks/orderStore";
import { currentPathname, renderApp, signInAs } from "@/test/renderApp";
import { server } from "@/test/server";
import { ACTION_SIZES } from "@/theme/theme";

/*
 * The cashier screen against the MSW backend (src/mocks: the V2 contract, priced like the backend).
 * Mock catalog: Margherita 101 M·Regular 4.000 / 102 L·Regular 5.000 / 103 M·Whole Wheat 5.000, add-ons
 * 1–3 at 1.000; Penne Pesto; Roast Beef folded sandwich 3.000; Soft Drink and Water 0.500.
 */

// The POS prices everything locally: no test may cause a quote request (POST /api/orders/quote).
let quoteRequests = 0;
beforeEach(() => {
  quoteRequests = 0;
  server.use(
    http.post("*/api/orders/quote", () => {
      quoteRequests += 1;
    })
  );
});
afterEach(() => expect(quoteRequests, "quote requests").toBe(0));

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
/** The product dialog's single total (footer), computed locally from the catalog. */
const expectDialogTotal = (dialog: HTMLElement, amount: string) =>
  waitFor(() => expect(within(dialog).getByText(/^Total/).nextSibling).toHaveTextContent(`${amount} JOD`));
/** The amount next to a summary label (the summary is the last occurrence of the label in the cart). */
const summaryValue = (label: string) => within(cart()).getAllByText(label).at(-1)?.nextSibling;

/** The cart's total on the checkout button (checkout enabled). */
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
const recordBodies = <T,>(path: "*/api/orders") => {
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
  it("customizes a product (variant, add-ons, quantity, note) with its total, and the cart shows the line price", async () => {
    const user = await openPos();
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
    await expectDialogTotal(dialog, "12.000"); // (5.000 + 1.000) × 2
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
    await expectDialogTotal(dialog, "6.000");

    // Back to regular: the same size (Medium) in that dough.
    await user.click(within(dialog).getByRole("tab", { name: "Regular" }));
    expect(within(dialog).getByRole("radio", { name: /Medium/ })).toBeChecked();
    await expectDialogTotal(dialog, "5.000");

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
    // Editing changes this line only: no staging of other configurations.
    expect(within(editor).queryByRole("button", { name: "Add another configuration" })).not.toBeInTheDocument();
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

describe("POS — several configurations in one product dialog", () => {
  const staged = (dialog: HTMLElement) => within(within(dialog).getByRole("region", { name: "Ready to add" })).getAllByRole("listitem");
  const addAnother = (dialog: HTMLElement) => within(dialog).getByRole("button", { name: "Add another configuration" });
  const lineMeta = (line: HTMLElement) => line.querySelector("[class*=lineMeta]")?.textContent ?? "";

  it("adds three configurations (doughs, sizes, add-ons, notes, quantities) in one session, with one combined total", async () => {
    const user = await openPos();
    const created = recordBodies<CreateOrderRequest>("*/api/orders");
    await user.click(screen.getByRole("button", { name: /^Margherita/ }));
    const dialog = await screen.findByRole("dialog", { name: "Margherita" });

    // 1 — Medium regular, Extra Basil, × 2, with a note
    await user.click(within(dialog).getByRole("checkbox", { name: /Extra Basil/ }));
    await user.click(within(dialog).getByRole("button", { name: "Increase quantity" }));
    await user.type(within(dialog).getByRole("textbox", { name: "Item notes" }), "well done");
    await user.click(addAnother(dialog));
    expect(staged(dialog)).toHaveLength(1);
    expect(staged(dialog)[0]).toHaveTextContent("Medium · Regular");
    expect(staged(dialog)[0]).toHaveTextContent("+ Extra Basil");
    expect(staged(dialog)[0]).toHaveTextContent("Note: well done");
    expect(within(staged(dialog)[0]).getByText("2 × Medium · Regular")).toBeInTheDocument();
    // The form starts again with nothing chosen, so nothing is added by accident.
    expect(within(dialog).queryAllByRole("radio", { checked: true })).toHaveLength(0);
    expect(within(dialog).queryAllByRole("checkbox", { checked: true })).toHaveLength(0);
    expect(within(dialog).getByRole("textbox", { name: "Item notes" })).toHaveValue("");
    expect(addAnother(dialog)).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Add all to order" })).toBeEnabled();

    // 2 — Large regular
    await user.click(within(dialog).getByRole("radio", { name: /Large/ }));
    await user.click(addAnother(dialog));
    expect(staged(dialog)).toHaveLength(2);

    // 3 — Whole wheat (Medium only) with Extra Mozzarella: the current form, added by "Add all"
    await user.click(within(dialog).getByRole("tab", { name: "Whole Wheat" }));
    expect(within(dialog).getByRole("radio", { name: /Medium/ })).toBeChecked();
    await user.click(within(dialog).getByRole("checkbox", { name: /Extra Mozzarella/ }));

    // One total for the three configurations: 2 × 5.000 + 5.000 + 6.000
    await expectDialogTotal(dialog, "21.000");
    expect(within(dialog).getByText("Total · 3 configurations")).toBeInTheDocument();
    expect(staged(dialog)[0]).toHaveTextContent("10.000 JOD");
    expect(staged(dialog)[1]).toHaveTextContent("5.000 JOD");

    await user.click(within(dialog).getByRole("button", { name: "Add all to order" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Margherita" })).not.toBeInTheDocument());
    await expectTotal("21.000");
    expect(cartLines().map(lineMeta)).toEqual(["Medium · Regular · + Extra Basil", "Large · Regular", "Medium · Whole Wheat · + Extra Mozzarella"]);
    expect(cartLines()[0]).toHaveTextContent("“well done”");
    expect(within(cart()).getByText("2 × Margherita")).toBeInTheDocument();
    expect(within(cart()).getByText("4 items")).toBeInTheDocument();

    // The order sends the three lines and the total shown; the backend agrees with it.
    const payment = await payWith(user, "Visa");
    await user.click(within(payment).getByRole("button", { name: /^Confirm payment/ }));
    await screen.findByRole("heading", { name: "Order created" });
    expect(created).toEqual([
      {
        items: [
          { variantId: 101, quantity: 2, addOnIds: [3], comment: "well done" },
          { variantId: 102, quantity: 1 },
          { variantId: 103, quantity: 1, addOnIds: [2] },
        ],
        paymentMethod: "VISA",
        expectedTotal: "21.000",
      },
    ]);
  });

  it("staged configurations can be re-counted, removed and edited; identical ones merge; the current form is never lost", async () => {
    const user = await openPos();
    await user.click(screen.getByRole("button", { name: /^Margherita/ }));
    const dialog = await screen.findByRole("dialog", { name: "Margherita" });

    await user.click(addAnother(dialog)); // Medium regular
    await user.click(within(dialog).getByRole("radio", { name: /Medium/ }));
    await user.click(addAnother(dialog)); // the same again: merged
    expect(staged(dialog)).toHaveLength(1);
    expect(within(staged(dialog)[0]).getByText("2 × Medium · Regular")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("radio", { name: /Large/ }));
    await user.click(addAnother(dialog));
    await user.click(within(dialog).getByRole("button", { name: "One more Large · Regular" }));
    expect(within(staged(dialog)[1]).getByText("2 × Large · Regular")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Remove Medium · Regular" }));
    expect(staged(dialog)).toHaveLength(1);

    // Editing a staged row while another configuration is being chosen keeps that one (staged), then loads the row.
    await user.click(within(dialog).getByRole("tab", { name: "Whole Wheat" }));
    await user.click(within(dialog).getByRole("button", { name: "Edit Large · Regular" }));
    expect(staged(dialog)).toHaveLength(1);
    expect(staged(dialog)[0]).toHaveTextContent("Medium · Whole Wheat");
    expect(within(dialog).getByRole("tab", { name: "Regular" })).toHaveAttribute("aria-selected", "true");
    expect(within(dialog).getByRole("radio", { name: /Large/ })).toBeChecked();

    await user.click(within(dialog).getByRole("checkbox", { name: /Extra Basil/ }));
    await expectDialogTotal(dialog, "17.000"); // 5.000 + 2 × (5.000 + 1.000)
    await user.click(within(dialog).getByRole("button", { name: "Add all to order" }));
    await expectTotal("17.000");
    expect(cartLines().map(lineMeta)).toEqual(["Medium · Whole Wheat", "Large · Regular · + Extra Basil"]);
    expect(within(cart()).getByText("2 × Margherita")).toBeInTheDocument();
  });

  it("no duplicates: the reset form is not added, a double click adds once, and identical lines merge in the cart", async () => {
    const user = await openPos();
    await addProduct(user, "Margherita"); // Medium regular already in the cart
    await expectTotal("4.000");

    await user.click(screen.getByRole("button", { name: /^Margherita/ }));
    const dialog = await screen.findByRole("dialog", { name: "Margherita" });
    await user.click(addAnother(dialog));
    await user.dblClick(within(dialog).getByRole("button", { name: "Add all to order" }));
    await expectTotal("8.000");
    expect(cartLines()).toHaveLength(1);
    expect(within(cart()).getByText("2 × Margherita")).toBeInTheDocument();
  });

  it("cancelling discards the staged configurations and leaves the cart as it was", async () => {
    const user = await openPos();
    await addProduct(user, "Water");
    await expectTotal("0.500");

    await user.click(screen.getByRole("button", { name: /^Margherita/ }));
    let dialog = await screen.findByRole("dialog", { name: "Margherita" });
    await user.click(addAnother(dialog));
    await user.click(within(dialog).getByRole("radio", { name: /Large/ }));
    await user.click(addAnother(dialog));
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Margherita" })).not.toBeInTheDocument());
    expect(cartLines()).toHaveLength(1);
    await expectTotal("0.500");

    await user.click(screen.getByRole("button", { name: /^Margherita/ }));
    dialog = await screen.findByRole("dialog", { name: "Margherita" });
    expect(within(dialog).queryByRole("region", { name: "Ready to add" })).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Add to order" })).toBeInTheDocument();
  });
});

describe("POS — action button sizes", () => {
  const height = (button: HTMLElement) => button.style.getPropertyValue("--button-height");
  const standard = rem(ACTION_SIZES.button);
  const compact = rem(ACTION_SIZES.compactButton);

  it("action buttons share one standard (40px), inline actions the compact one (34px), icons 36px", async () => {
    const user = await openPos();
    await user.click(screen.getByRole("button", { name: /^Margherita/ }));
    const dialog = await screen.findByRole("dialog", { name: "Margherita" });
    expect(height(within(dialog).getByRole("button", { name: "Cancel" }))).toBe(standard);
    expect(height(within(dialog).getByRole("button", { name: "Add to order" }))).toBe(standard);
    expect(height(within(dialog).getByRole("button", { name: "Add another configuration" }))).toBe(compact);
    await user.click(within(dialog).getByRole("button", { name: "Add to order" }));
    await expectTotal("4.000");

    expect(height(checkout())).toBe(standard); // no longer oversized
    expect(height(within(cart()).getByRole("button", { name: "Clear" }))).toBe(compact);
    expect(within(cart()).getByRole("button", { name: "Edit Margherita" }).style.getPropertyValue("--ai-size")).toBe(rem(ACTION_SIZES.icon));

    const payment = await payWith(user, "Cash");
    expect(height(within(payment).getByRole("button", { name: /^Confirm payment/ }))).toBe(standard);
    expect(height(within(payment).getByRole("button", { name: "Back" }))).toBe(standard);
    expect(height(within(payment).getByRole("button", { name: "Exact" }))).toBe(compact);
    await user.click(within(payment).getByRole("button", { name: "Exact" }));
    await user.click(within(payment).getByRole("button", { name: /^Confirm payment/ }));

    await screen.findByRole("heading", { name: "Order created" });
    expect(height(screen.getByRole("button", { name: "New order" }))).toBe(standard);
    expect(height(screen.getByRole("button", { name: "View order" }))).toBe(standard);
  });
});

describe("POS — order details", () => {
  it("delivery fields appear for delivery only; a dine-in order never sends them", async () => {
    const user = await openPos();
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
    expect(summaryValue("Delivery fee")).toHaveTextContent("1.500 JOD");

    // Back to dine-in: the typed address and fee stay hidden, are not priced and are not sent.
    await user.click(within(cart()).getByRole("radio", { name: "Dine-in" }));
    await expectTotal("0.500");
    expect(within(cart()).queryByRole("textbox", { name: /Delivery address/ })).not.toBeInTheDocument();
    expect(within(cart()).queryByText("Delivery fee")).not.toBeInTheDocument();

    const dialog = await payWith(user, "Visa");
    await user.click(within(dialog).getByRole("button", { name: /^Confirm payment/ }));
    await screen.findByRole("heading", { name: "Order created" });
    expect(created).toEqual([{ items: [{ variantId: 100, quantity: 1 }], paymentMethod: "VISA", expectedTotal: "0.500" }]);
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

  it("the discount is a percentage; the amount is rounded half up like the backend", async () => {
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

describe("POS — local pricing; the backend checks the total (D77)", () => {
  const catalogResponse = (catalog: CatalogCategory[]) => HttpResponse.json({ response: catalog, message: "Catalog fetched." });
  /** The mock catalog with Margherita Medium at another price (the backend still charges 4.000). */
  const withMargheritaPrice = (price: string) => {
    const catalog = structuredClone(MOCK_CATALOG);
    catalog[0].products[0].variants[0].price = price;
    return catalog;
  };

  it("totals change at once and nothing is requested until the order is created", async () => {
    const user = await openPos();
    const requests: string[] = [];
    const record = ({ request }: { request: Request }) => requests.push(`${request.method} ${new URL(request.url).pathname}`);
    server.events.on("request:start", record);
    try {
      await addProduct(user, "Margherita", async (dialog) => {
        await user.click(within(dialog).getByRole("checkbox", { name: /Extra Basil/ }));
        await user.click(within(dialog).getByRole("button", { name: "Add another configuration" }));
        await user.click(within(dialog).getByRole("radio", { name: /Large/ }));
        await user.click(within(dialog).getByRole("button", { name: "Add all to order" }));
      }).catch(() => undefined);
      await waitFor(() => expect(screen.queryByRole("dialog", { name: "Margherita" })).not.toBeInTheDocument());
      // No waiting: each change shows its price immediately.
      expect(checkout()).toHaveAccessibleName("Checkout · 10.000 JOD");
      await user.click(within(cart()).getAllByRole("button", { name: "One more Margherita" })[1]);
      expect(checkout()).toHaveAccessibleName("Checkout · 15.000 JOD");
      await user.type(within(cart()).getByRole("textbox", { name: /Discount/ }), "10");
      expect(checkout()).toHaveAccessibleName("Checkout · 13.500 JOD");
      await user.click(within(cart()).getByRole("radio", { name: "Delivery" }));
      await user.type(within(cart()).getByRole("textbox", { name: /Delivery address/ }), "Building 5");
      await user.type(within(cart()).getByRole("textbox", { name: /Delivery fee/ }), "1.250");
      expect(checkout()).toHaveAccessibleName("Checkout · 14.750 JOD");
      expect(requests).toEqual([]);

      const payment = await payWith(user, "Cash", "20");
      expect(within(payment).getByText("Change").nextSibling).toHaveTextContent("5.250 JOD");
      await user.click(within(payment).getByRole("button", { name: /^Confirm payment/ }));
      await screen.findByRole("heading", { name: "Order created" });
      expect(requests).toEqual(["POST /api/orders"]);
    } finally {
      server.events.removeListener("request:start", record);
    }
  });

  it("a price changed after the menu was loaded: nothing is created, the new total is shown, the cashier confirms again", async () => {
    server.use(http.get("*/api/catalog", () => catalogResponse(withMargheritaPrice("3.500")), { once: true }));
    const user = await openPos();
    const created = recordBodies<CreateOrderRequest>("*/api/orders");
    await addProduct(user, "Margherita");
    await expectTotal("3.500");

    const dialog = await payWith(user, "Visa");
    await user.click(within(dialog).getByRole("button", { name: /^Confirm payment/ }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Prices changed since the menu was loaded. The total is now 4.000 JOD. Check it with the customer and confirm again."
    );
    expect(store.listOrders({ pageSize: 10 }).items).toHaveLength(0);
    // The menu is reloaded, so every amount shows the current price; nothing is sent again by itself.
    await waitFor(() => expect(within(dialog).getByRole("button", { name: /^Confirm payment/ })).toHaveAccessibleName("Confirm payment · 4.000 JOD"));
    expect(cartLines()[0]).toHaveTextContent("4.000 JOD");
    expect(created).toHaveLength(1);

    await user.click(within(dialog).getByRole("button", { name: /^Confirm payment/ }));
    await screen.findByRole("heading", { name: "Order created" });
    expect(screen.getByText("Order #1")).toBeInTheDocument();
    expect(created.map((body) => body.expectedTotal)).toEqual(["3.500", "4.000"]);
    expect(store.listOrders({ pageSize: 10 }).items).toHaveLength(1);
  });

  it("an item the reloaded menu no longer sells is marked and blocks checkout until it is removed", async () => {
    const withoutWater = structuredClone(MOCK_CATALOG);
    for (const category of withoutWater) category.products = category.products.filter((product) => product.nameEn !== "Water");
    server.use(http.get("*/api/catalog", () => catalogResponse(withoutWater)));
    server.use(http.get("*/api/catalog", () => catalogResponse(withMargheritaPrice("3.500")), { once: true }));
    const user = await openPos();
    await addProduct(user, "Margherita");
    await addProduct(user, "Water");
    await expectTotal("4.000");

    const dialog = await payWith(user, "Visa");
    await user.click(within(dialog).getByRole("button", { name: /^Confirm payment/ }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Payment" })).not.toBeInTheDocument());
    expect(cartLines()[1]).toHaveTextContent("Unavailable");
    expect(within(cart()).getByText("An item is no longer on the menu. Remove it to continue.")).toBeInTheDocument();
    expect(checkout()).toBeDisabled();
    expect(store.listOrders({ pageSize: 10 }).items).toHaveLength(0);

    expect(cartLines()[1]).toHaveTextContent("Water");
    await user.click(within(cart()).getByRole("button", { name: "Remove Water" }));
    await expectTotal("4.000");
    const payment = await payWith(user, "Visa");
    await user.click(within(payment).getByRole("button", { name: /^Confirm payment/ }));
    expect(await screen.findByRole("heading", { name: "Order created" })).toBeInTheDocument();
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
