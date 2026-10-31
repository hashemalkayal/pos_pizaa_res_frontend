import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import i18n from "@/i18n";
import * as menu from "@/mocks/menuStore";
import * as store from "@/mocks/orderStore";
import { currentPathname, renderApp, signInAs } from "@/test/renderApp";
import { server } from "@/test/server";

/*
 * Menu management (ADMIN only, D80) against the MSW backend (src/mocks/menuStore: the menu the POS and the order
 * pricing read too). Two tabs: Menu (categories → products → option tabs → variants) and Add-ons. Fixture: Pizza
 * (Margherita: Medium · Regular 4.000, Large · Regular 5.000, Medium · Whole Wheat 5.000; add-ons Extra Tomato Sauce,
 * Extra Mozzarella, Extra Basil at 1.000), Manakish (Za'atar: Regular / Whole Wheat dough), Folded Sandwiches, Pasta
 * (Penne Pesto: Regular / Whole Wheat Penne; Extra Chicken), Drinks (Soft Drink, Water 0.500) and the empty Staff Meal.
 */

type OrderBody = Parameters<typeof store.validateCreate>[0];
const createOrder = (body: Partial<Record<string, unknown>>) =>
  store.createOrder(store.validateCreate({ paymentMethod: "CASH", ...body } as OrderBody), { id: 2, name: "Mock Cashier" });

const openMenu = async (path = "/catalog") => {
  signInAs("ADMIN");
  renderApp(path);
  await screen.findByRole("heading", { level: 1, name: "Menu" }, { timeout: 5000 });
  await screen.findAllByRole("tab", undefined, { timeout: 5000 }); // the Menu page is a lazy chunk
  return userEvent.setup();
};

const navigation = () => screen.getByRole("navigation", { name: "Main navigation" });
const levels = () => screen.getByRole("navigation", { name: "Menu levels" });
const crumbs = () => levels().textContent;
const title = () => within(levels()).getByRole("heading", { level: 2 });
const panel = () => screen.getByRole("tabpanel");
const card = (name: RegExp) => within(panel()).getByRole("button", { name });
const queryCard = (name: RegExp) => within(panel()).queryByRole("button", { name });
const drawer = (name: string | RegExp) => screen.findByRole("dialog", { name }, { timeout: 5000 });

/** Opens a category, then (optionally) one of its products, by their card names. */
const drillInto = async (user: UserEvent, category: string, product?: string) => {
  await user.click(await screen.findByRole("button", { name: new RegExp(`^${category},`) }));
  await waitFor(() => expect(title()).toHaveTextContent(category));
  if (product) {
    await user.click(await screen.findByRole("button", { name: new RegExp(`^${product},`) }));
    await waitFor(() => expect(title()).toHaveTextContent(product));
  }
};

/** Records every request to a path (method, URL, JSON body). */
const record = (method: "get" | "post" | "patch" | "put", path: string) => {
  const calls: { url: URL; body: unknown }[] = [];
  server.use(
    http[method](path, async ({ request }) => {
      calls.push({ url: new URL(request.url), body: method === "get" ? null : await request.clone().json().catch(() => null) });
    })
  );
  return calls;
};

const goToPos = async (user: UserEvent) => {
  await user.click(within(navigation()).getByRole("link", { name: /POS/ }));
  await screen.findByRole("button", { name: /^Margherita/ }, { timeout: 5000 });
};

describe("Menu — access and tabs", () => {
  it("a cashier has no Menu link, and /catalog shows the role notice without loading the menu", async () => {
    const reads = record("get", "*/api/categories");
    signInAs("CASHER");
    renderApp("/catalog/menu");
    expect(await screen.findByText("Not available for your role")).toBeInTheDocument();
    expect(within(navigation()).queryByRole("link", { name: /Menu/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(reads).toHaveLength(0);
  });

  it("an admin sees exactly two tabs, Menu and Add-ons; the open tab is kept in the address", async () => {
    const user = await openMenu();
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Menu", "Add-ons"]);
    expect(screen.getByRole("tab", { name: "Menu" })).toHaveAttribute("aria-selected", "true");
    expect(title()).toHaveTextContent("Categories");
    await user.click(screen.getByRole("tab", { name: "Add-ons" }));
    await waitFor(() => expect(currentPathname()).toBe("/catalog/addons"));
    expect(await screen.findByRole("button", { name: /^Extra Basil/ })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Menu levels" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Menu" }));
    await waitFor(() => expect(currentPathname()).toBe("/catalog/menu"));
    expect(await screen.findByRole("button", { name: /^Pizza,/ })).toBeInTheDocument();
  });
});

describe("Menu — categories (level 1)", () => {
  it("category cards with names, product counts and a picture: the category icon when there is no image", async () => {
    await openMenu();
    expect(await screen.findByText("6 categories")).toBeInTheDocument();
    const pizza = card(/^Pizza, 1 product$/);
    expect(pizza).toHaveTextContent("بيتزا");
    expect(within(pizza).getByTestId("category-icon")).toBeInTheDocument();
    expect(within(pizza).queryByRole("img")).not.toBeInTheDocument();
    expect(within(pizza).queryAllByRole("button")).toHaveLength(0); // no actions on a card
    expect(within(card(/^Staff Meal, 0 products$/)).getByTestId("category-icon")).toBeInTheDocument();
  });

  it("pictures: the category's image, else a product photo of the category; a broken image falls back to the icon", async () => {
    server.use(
      http.get("*/api/categories", () =>
        HttpResponse.json({ response: menu.listCategories().map((c) => (c.id === 1 ? { ...c, imageUrl: "https://img.example/pizza.jpg" } : c)), message: "Categories fetched." })
      ),
      http.get("*/api/catalog", () =>
        HttpResponse.json({
          response: menu.getMenu().map((c) => (c.id === 2 ? { ...c, products: c.products.map((p) => ({ ...p, imageUrl: "https://img.example/zaatar.jpg" })) } : c)),
          message: "Catalog fetched.",
        })
      )
    );
    await openMenu();
    await screen.findByText("6 categories");
    const pizzaImage = card(/^Pizza,/).querySelector("img")!;
    expect(pizzaImage).toHaveAttribute("src", "https://img.example/pizza.jpg");
    await waitFor(() => expect(card(/^Manakish,/).querySelector("img")).toHaveAttribute("src", "https://img.example/zaatar.jpg"));
    fireEvent.error(pizzaImage);
    await waitFor(() => expect(within(card(/^Pizza,/)).getByTestId("category-icon")).toBeInTheDocument());
    expect(card(/^Pizza,/).querySelector("img")).toBeNull();
  });

  it("create with validation; a card opens the category's products; the category is edited from Category details", async () => {
    const posts = record("post", "*/api/categories");
    const user = await openMenu();
    await user.click(await screen.findByRole("button", { name: "Add category" }));
    let form = await drawer("New category");
    await user.click(within(form).getByRole("button", { name: "Save" }));
    expect(within(form).getAllByText("Required.")).toHaveLength(2);
    expect(posts).toHaveLength(0);
    await user.type(within(form).getByRole("textbox", { name: /Name \(English\)/ }), "Desserts");
    await user.type(within(form).getByRole("textbox", { name: /Name \(Arabic\)/ }), "حلويات");
    await user.click(within(form).getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Desserts added.")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /^Desserts, 0 products$/ })).toBeInTheDocument();
    expect(posts.map((post) => post.body)).toEqual([{ nameEn: "Desserts", nameAr: "حلويات", sortOrder: 0 }]);

    await drillInto(user, "Pizza");
    await user.click(screen.getByRole("button", { name: "Category details" }));
    form = await drawer("Pizza");
    await user.click(within(form).getByRole("button", { name: "Delete" }));
    await user.click(within(await screen.findByRole("dialog", { name: "Delete Pizza?" })).getByRole("button", { name: "Delete" }));
    expect(await within(form).findByRole("alert")).toHaveTextContent("This category still has products. Move them to another category or delete them first.");

    await user.click(within(form).getByRole("button", { name: "Edit" }));
    const name = within(form).getByRole("textbox", { name: /Name \(English\)/ });
    expect(within(form).getByRole("button", { name: "Save" })).toBeDisabled();
    await user.clear(name);
    await user.type(name, "Pizzas");
    await user.click(within(form).getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Changes saved.")).toBeInTheDocument();
    await waitFor(() => expect(title()).toHaveTextContent("Pizzas"));
  });

  it("an empty category is deleted after confirmation (Keep cancels); the menu returns to the categories", async () => {
    const archives = record("post", "*/api/categories/:id/archive");
    const user = await openMenu();
    await drillInto(user, "Staff Meal");
    expect(screen.getByText("No products in this category yet.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Category details" }));
    const form = await drawer("Staff Meal");
    await user.click(within(form).getByRole("button", { name: "Delete" }));
    let confirm = await screen.findByRole("dialog", { name: "Delete Staff Meal?" });
    await user.click(within(confirm).getByRole("button", { name: "Keep" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Delete Staff Meal?" })).not.toBeInTheDocument());
    expect(archives).toHaveLength(0);

    await user.click(within(form).getByRole("button", { name: "Delete" }));
    confirm = await screen.findByRole("dialog", { name: "Delete Staff Meal?" });
    await user.click(within(confirm).getByRole("button", { name: "Delete" }));
    expect(await screen.findByText("Staff Meal deleted.")).toBeInTheDocument();
    await waitFor(() => expect(title()).toHaveTextContent("Categories"));
    expect(await screen.findByText("5 categories")).toBeInTheDocument();
    expect(queryCard(/^Staff Meal/)).not.toBeInTheDocument();
    expect(archives.map((call) => call.url.pathname)).toEqual(["/api/categories/8/archive"]);
  });

  it("closing the category drawer while editing never saves", async () => {
    const patches = record("patch", "*/api/categories/:id");
    const user = await openMenu();
    await drillInto(user, "Drinks");
    await user.click(screen.getByRole("button", { name: "Category details" }));
    const form = await drawer("Drinks");
    await user.click(within(form).getByRole("button", { name: "Edit" }));
    await user.type(within(form).getByRole("textbox", { name: /Name \(English\)/ }), " & Juices");
    await user.click(within(form).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Drinks" })).not.toBeInTheDocument());
    expect(patches).toHaveLength(0);
    expect(title()).toHaveTextContent("Drinks");
  });
});

describe("Menu — products of a category (level 2)", () => {
  it("only the category's products, 20 per page, searched on the server within the category; Back and breadcrumbs go up", async () => {
    for (let index = 1; index <= 20; index += 1) menu.createProduct({ categoryId: 7, nameEn: `Juice ${index}`, nameAr: `عصير ${index}`, usesUnits: false });
    const lists = record("get", "*/api/products");
    const user = await openMenu();
    await drillInto(user, "Pizza");
    expect(crumbs()).toBe("CategoriesPizza");
    expect(await screen.findByText("1 product")).toBeInTheDocument();
    expect(card(/^Margherita, 3 variants$/)).toHaveTextContent("مارجريتا");
    expect(queryCard(/^Water,/)).not.toBeInTheDocument();
    expect(lists.at(-1)!.url.searchParams.get("categoryId")).toBe("1");

    await user.click(screen.getByRole("button", { name: "Back" }));
    await waitFor(() => expect(title()).toHaveTextContent("Categories"));
    await drillInto(user, "Drinks");
    expect(await screen.findByText("22 products")).toBeInTheDocument();
    expect(within(panel()).getAllByRole("button", { name: /^(Juice \d+|Soft Drink|Water), / })).toHaveLength(20);
    expect(lists.at(-1)!.url.searchParams.get("pageSize")).toBe("20");
    expect(queryCard(/^Margherita,/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() => expect(within(panel()).getAllByRole("button", { name: /^(Juice \d+|Soft Drink|Water), / })).toHaveLength(2));

    await user.type(screen.getByRole("textbox", { name: "Search products" }), "wat");
    expect(await screen.findByText("1 product")).toBeInTheDocument();
    expect(card(/^Water, 1 variant$/)).toBeInTheDocument();
    expect(lists.at(-1)!.url.searchParams.get("q")).toBe("wat");
    expect(lists.at(-1)!.url.searchParams.get("categoryId")).toBe("7");

    await user.click(within(levels()).getByRole("button", { name: "Categories" }));
    await waitFor(() => expect(title()).toHaveTextContent("Categories"));
  });

  it("Add product creates it in the open category (a draft until it has a variant); the structure locks once it has variants", async () => {
    const posts = record("post", "*/api/products");
    const user = await openMenu();
    await drillInto(user, "Drinks");
    await user.click(screen.getByRole("button", { name: "Add product" }));
    const form = await drawer("New product");
    expect(within(form).getByRole("textbox", { name: /Category/ })).toHaveValue("Drinks");
    await user.type(within(form).getByRole("textbox", { name: /Name \(English\)/ }), "Orange Juice");
    await user.type(within(form).getByRole("textbox", { name: /Name \(Arabic\)/ }), "عصير برتقال");
    await user.click(within(form).getByRole("switch", { name: /Sold in sizes/ }));
    await user.click(within(form).getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Orange Juice added.")).toBeInTheDocument();
    expect(posts[0].body).toEqual({ categoryId: 7, nameEn: "Orange Juice", nameAr: "عصير برتقال", descriptionEn: null, descriptionAr: null, sortOrder: 0, usesUnits: true, optionGroupIds: [] });
    expect(await screen.findByRole("button", { name: /^Orange Juice, No variants yet: not in the POS$/ })).toBeInTheDocument();

    await user.click(within(levels()).getByRole("button", { name: "Categories" }));
    await drillInto(user, "Pizza", "Margherita");
    await user.click(screen.getByRole("button", { name: "Product details" }));
    const margherita = await drawer("Margherita");
    expect(margherita).toHaveTextContent("Dough Type");
    await user.click(within(margherita).getByRole("button", { name: "Edit" }));
    expect(within(margherita).getByRole("status")).toHaveTextContent("Sizes and options can't change once the product has variants.");
    expect(within(margherita).queryByRole("switch")).not.toBeInTheDocument();
  });

  it("delete a product from Product details: back to its category, gone from the POS; a past order keeps it", async () => {
    const order = createOrder({ items: [{ variantId: 100, quantity: 2 }] });
    const user = await openMenu();
    await drillInto(user, "Drinks", "Water");
    await user.click(screen.getByRole("button", { name: "Product details" }));
    const form = await drawer("Water");
    await user.click(within(form).getByRole("button", { name: "Delete" }));
    await user.click(within(await screen.findByRole("dialog", { name: "Delete Water?" })).getByRole("button", { name: "Delete" }));
    expect(await screen.findByText("Water deleted.")).toBeInTheDocument();
    await waitFor(() => expect(title()).toHaveTextContent("Drinks"));
    await waitFor(() => expect(queryCard(/^Water,/)).not.toBeInTheDocument());

    // The POS shows its cached menu at once and refreshes it (the change marked it stale).
    await goToPos(user);
    await waitFor(() => expect(screen.queryByRole("button", { name: /^Water/ })).not.toBeInTheDocument());
    expect(() => createOrder({ items: [{ variantId: 100, quantity: 1 }] })).toThrow(/not available/);
    expect(store.findOrder(order.id).items[0]).toMatchObject({ productNameEn: "Water", quantity: 2, unitPrice: "0.500" });
    expect(store.findOrder(order.id).totalAmount).toBe(order.totalAmount);
  });
});

describe("Menu — a product's options, sizes and prices (levels 3–4)", () => {
  it("a pizza: dough tabs from its own option group, each with its sizes and prices; Back returns to the category", async () => {
    const user = await openMenu();
    await drillInto(user, "Pizza", "Margherita");
    expect(crumbs()).toBe("CategoriesPizzaMargherita");
    const doughs = screen.getByRole("tablist", { name: "Dough Type" });
    expect(within(doughs).getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Regular", "Whole Wheat"]);
    expect(within(doughs).getByRole("tab", { name: "Regular" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Sizes and prices")).toBeInTheDocument();
    expect(screen.getByText("2 variants")).toBeInTheDocument();
    expect(card(/^Medium, 4\.000$/)).toHaveTextContent("PIZZA-MARGHERITA-M-REGULAR");
    expect(card(/^Large, 5\.000$/)).toBeInTheDocument();

    await user.click(within(doughs).getByRole("tab", { name: "Whole Wheat" }));
    await waitFor(() => expect(screen.getByText("1 variant")).toBeInTheDocument());
    expect(card(/^Medium, 5\.000$/)).toHaveTextContent("PIZZA-MARGHERITA-M-WHOLE-WHEAT");
    expect(queryCard(/^Large,/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back" }));
    await waitFor(() => expect(title()).toHaveTextContent("Pizza"));
    expect(card(/^Margherita,/)).toBeInTheDocument();
  });

  it("pasta and manakish: their own option tabs (pasta type, dough); a product without options lists its variants directly", async () => {
    const user = await openMenu();
    await drillInto(user, "Pasta", "Penne Pesto");
    const types = screen.getByRole("tablist", { name: "Pasta Type" });
    expect(within(types).getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Regular Penne", "Whole Wheat Penne"]);
    expect(screen.getByText("Prices")).toBeInTheDocument();
    expect(card(/^Regular Penne, 4\.500$/)).toBeInTheDocument();
    await user.click(within(types).getByRole("tab", { name: "Whole Wheat Penne" }));
    expect(await screen.findByRole("button", { name: /^Whole Wheat Penne, 5\.500$/ })).toBeInTheDocument();

    await user.click(within(levels()).getByRole("button", { name: "Categories" }));
    await drillInto(user, "Manakish", "Za'atar");
    expect(within(screen.getByRole("tablist", { name: "Dough Type" })).getAllByRole("tab")).toHaveLength(2);

    await user.click(within(levels()).getByRole("button", { name: "Categories" }));
    await drillInto(user, "Drinks", "Water");
    expect(screen.queryByRole("tablist", { name: /Type/ })).not.toBeInTheDocument();
    expect(card(/^Water, 0\.500$/)).toHaveTextContent("DRINKS-WATER");
  });

  it("Add variant in a dough tab: that dough is set; an existing combination is refused; a deleted one can be added again", async () => {
    const user = await openMenu();
    await drillInto(user, "Pizza", "Margherita");
    await user.click(within(screen.getByRole("tablist", { name: "Dough Type" })).getByRole("tab", { name: "Whole Wheat" }));
    const addLarge = async (price: string) => {
      await user.click(screen.getByRole("button", { name: "Add variant" }));
      const form = await drawer("New variant");
      expect(within(form).getByText("Dough Type").nextSibling).toHaveTextContent("Whole Wheat");
      expect(within(form).queryByRole("textbox", { name: /Dough Type/ })).not.toBeInTheDocument();
      await user.click(within(form).getByRole("textbox", { name: /Size/ }));
      await user.click(await screen.findByRole("option", { name: "Large" }));
      await user.type(within(form).getByRole("textbox", { name: /Price/ }), price);
      await user.click(within(form).getByRole("button", { name: "Save" }));
      return form;
    };

    let form = await addLarge("6.000");
    expect(await screen.findByText("Large · Whole Wheat added.")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /^Large, 6\.000$/ })).toBeInTheDocument();
    expect(screen.getByText("2 variants")).toBeInTheDocument();

    form = await addLarge("6.000");
    expect(await within(form).findByRole("alert")).toHaveTextContent("This product already has a variant with this size and these options.");
    await user.click(within(form).getByRole("button", { name: "Cancel" }));

    await user.click(card(/^Large, 6\.000$/));
    form = await drawer(/Margherita · Large · Whole Wheat/);
    await user.click(within(form).getByRole("button", { name: "Delete" }));
    await user.click(within(await screen.findByRole("dialog", { name: "Delete Large · Whole Wheat?" })).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(queryCard(/^Large,/)).not.toBeInTheDocument());

    await addLarge("6.500");
    expect(await screen.findByRole("button", { name: /^Large, 6\.500$/ })).toBeInTheDocument();
    await user.click(within(screen.getByRole("tablist", { name: "Dough Type" })).getByRole("tab", { name: "Regular" }));
    await waitFor(() => expect(screen.getByText("2 variants")).toBeInTheDocument());
    expect(queryCard(/^Large, 6\.500$/)).not.toBeInTheDocument();
  });

  it("editing a price: the POS shows and charges the new price", async () => {
    const user = await openMenu();
    await drillInto(user, "Pizza", "Margherita");
    await user.click(card(/^Medium, 4\.000$/));
    const form = await drawer(/Margherita · Medium · Regular/);
    await user.click(within(form).getByRole("button", { name: "Edit" }));
    const price = within(form).getByRole("textbox", { name: /Price/ });
    await user.clear(price);
    await user.type(price, "4.250");
    await user.click(within(form).getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Changes saved.")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /^Medium, 4\.250$/ })).toBeInTheDocument();

    await goToPos(user);
    await waitFor(() => expect(screen.getByRole("button", { name: /^Margherita/ })).toHaveTextContent("4.250 JOD"));
    expect(createOrder({ items: [{ variantId: 101, quantity: 1 }] }).totalAmount).toBe("4.250");
  });

  it("deleting a product's only variant takes the product out of the POS", async () => {
    const user = await openMenu();
    await drillInto(user, "Drinks", "Soft Drink");
    await user.click(card(/^Soft Drink, 0\.500$/));
    const form = await drawer(/^Soft Drink · Soft Drink/);
    await user.click(within(form).getByRole("button", { name: "Delete" }));
    const confirm = await screen.findByRole("dialog", { name: "Delete Soft Drink?" });
    expect(confirm).toHaveTextContent("If it is the product's last variant, the product leaves the POS until a new one is added.");
    await user.click(within(confirm).getByRole("button", { name: "Delete" }));
    expect(await screen.findByText("This product has no variants yet. It is not shown in the POS until it has one.")).toBeInTheDocument();

    await goToPos(user);
    await waitFor(() => expect(screen.queryByRole("button", { name: /^Soft Drink/ })).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: /^Water/ })).toBeInTheDocument();
  });

  it("opens directly from the address (?category=&product=&option=)", async () => {
    await openMenu("/catalog/menu?category=1&product=1&option=2");
    expect(await screen.findByRole("button", { name: /^Medium, 5\.000$/ })).toBeInTheDocument();
    expect(within(screen.getByRole("tablist", { name: "Dough Type" })).getByRole("tab", { name: "Whole Wheat" })).toHaveAttribute("aria-selected", "true");
    expect(crumbs()).toBe("CategoriesPizzaMargherita");
  });

  it("an unknown product in the address is reported as missing, with Back to its category", async () => {
    const user = await openMenu("/catalog/menu?category=1&product=999");
    expect(await screen.findByText("This item no longer exists.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(await screen.findByRole("button", { name: /^Margherita,/ })).toBeInTheDocument();
  });
});

describe("Menu — add-ons", () => {
  it("creates an add-on, offers it on a product at a price (shown in the POS), and stops offering it", async () => {
    const puts = record("put", "*/api/products/:id/add-ons/:addOnId");
    const user = await openMenu("/catalog/addons");
    expect(await screen.findByText("4 add-ons")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add add-on" }));
    const form = await drawer("New add-on");
    await user.type(within(form).getByRole("textbox", { name: /Name \(English\)/ }), "Extra Olives");
    await user.type(within(form).getByRole("textbox", { name: /Name \(Arabic\)/ }), "إضافة زيتون");
    await user.click(within(form).getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Extra Olives added.")).toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: /^Extra Olives/ }));
    const olives = await drawer("Extra Olives");
    const prices = within(olives).getByRole("region", { name: "Products and prices" });
    expect(await within(prices).findByText("Not offered on any product yet.")).toBeInTheDocument();
    await user.click(within(prices).getByRole("textbox", { name: "Product" }));
    await user.click(await screen.findByRole("option", { name: "Margherita · Pizza" }));
    await user.click(within(prices).getByRole("button", { name: "Save price" }));
    expect(within(prices).getByText("Enter an amount with up to 3 decimals, for example 1.500.")).toBeInTheDocument();
    await user.type(within(prices).getByRole("textbox", { name: "Price (JOD)" }), "0.750");
    await user.click(within(prices).getByRole("button", { name: "Save price" }));
    expect(await screen.findByText("Price saved for Margherita.")).toBeInTheDocument();
    await waitFor(() => expect(within(prices).getByRole("listitem")).toHaveTextContent("Margherita0.750 JOD"));
    expect(puts.map((call) => [call.url.pathname, call.body])).toEqual([["/api/products/1/add-ons/1000", { price: "0.750", isActive: true }]]);
    expect(menu.getMenu()[0].products[0].addOns.map((addOn) => `${addOn.nameEn} ${addOn.price}`)).toContain("Extra Olives 0.750");

    await user.click(within(prices).getByRole("button", { name: "Stop offering on Margherita" }));
    expect(await screen.findByText("No longer offered on Margherita.")).toBeInTheDocument();
    expect(await within(prices).findByText("Not offered on any product yet.")).toBeInTheDocument();
    expect(menu.getMenu()[0].products[0].addOns.map((addOn) => addOn.nameEn)).not.toContain("Extra Olives");
  });

  it("delete: no longer offered in the POS or on new orders; a past order keeps the add-on and its price", async () => {
    const order = createOrder({ items: [{ variantId: 101, quantity: 1, addOnIds: [3] }] });
    const user = await openMenu("/catalog/addons");
    await user.click(await screen.findByRole("button", { name: /^Extra Basil/ }));
    const form = await drawer("Extra Basil");
    expect(within(form).getByRole("region", { name: "Products and prices" })).toHaveTextContent("Margherita1.000 JOD");
    await user.click(within(form).getByRole("button", { name: "Delete" }));
    await user.click(within(await screen.findByRole("dialog", { name: "Delete Extra Basil?" })).getByRole("button", { name: "Delete" }));
    expect(await screen.findByText("Extra Basil deleted.")).toBeInTheDocument();
    await waitFor(() => expect(queryCard(/^Extra Basil/)).not.toBeInTheDocument());

    await goToPos(user);
    await user.click(screen.getByRole("button", { name: /^Margherita/ }));
    const product = await screen.findByRole("dialog", { name: "Margherita" });
    expect(within(product).getByText("Extra Mozzarella")).toBeInTheDocument();
    expect(within(product).queryByText("Extra Basil")).not.toBeInTheDocument();
    expect(() => createOrder({ items: [{ variantId: 101, quantity: 1, addOnIds: [3] }] })).toThrow(/not available/);

    expect(store.findOrder(order.id).items[0].addOns).toEqual([{ addOnId: 3, nameEn: "Extra Basil", nameAr: "إضافة ريحان", unitPrice: "1.000" }]);
    expect(store.findOrder(order.id).totalAmount).toBe("5.000");
  });
});


describe("Menu — Arabic", () => {
  it("tabs, breadcrumbs, Back, option tabs and drawers in Arabic, right to left", async () => {
    await act(async () => {
      await i18n.changeLanguage("ar");
    });
    signInAs("ADMIN");
    renderApp("/catalog/menu?category=1&product=1");
    const doughs = await screen.findByRole("tablist", { name: "نوع العجينة" }, { timeout: 5000 });
    expect(document.documentElement.dir).toBe("rtl");
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["القائمة", "الإضافات", "عادية", "قمح كامل"]);
    const levels = screen.getByRole("navigation", { name: "مستويات القائمة" });
    expect(levels).toHaveTextContent("الفئاتبيتزامارجريتا");
    expect(within(levels).getByRole("heading", { level: 2 })).toHaveTextContent("مارجريتا");
    expect(screen.getByText("الأحجام والأسعار")).toBeInTheDocument();
    expect(within(doughs).getByRole("tab", { name: "عادية" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("خياران")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^وسط, 4\.000$/ })).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "تفاصيل المنتج" }));
    const form = await screen.findByRole("dialog", { name: "مارجريتا" });
    expect(within(form).getByText("الفئة").nextSibling).toHaveTextContent("بيتزا");
    expect(within(form).getByRole("button", { name: "إغلاق" })).toBeInTheDocument();
    await user.click(within(form).getByRole("button", { name: "إغلاق" }));

    await user.click(screen.getByRole("button", { name: "رجوع" }));
    expect(await screen.findByRole("button", { name: /^مارجريتا, / })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "إضافة منتج" })).toBeInTheDocument();
  });
});
