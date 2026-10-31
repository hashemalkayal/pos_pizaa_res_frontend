import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { currentPathname, renderApp, signInAs } from "@/test/renderApp";
import { CAPABILITIES, CATEGORIES, FEATURED } from "./catalog";

/**
 * Discover More (ADMIN only): a preview of PLANNED modules. Every card says "Planned", no card offers a control, and
 * the page makes no API call of its own.
 */

const openDiscover = async (path = "/discover") => {
  signInAs("ADMIN");
  renderApp(path);
  await screen.findByRole("heading", { level: 1, name: "Discover More" }, { timeout: 5000 });
  await screen.findByRole("heading", { level: 2, name: "Explore what's next for Engineers Pizza POS" }, { timeout: 5000 });
  return userEvent.setup();
};

const navigation = () => screen.getByRole("navigation", { name: "Main navigation" });
const browse = () => screen.getByRole("region", { name: "All planned capabilities" });
const browseCards = () => within(browse()).queryAllByRole("article");

afterEach(async () => {
  await act(() => i18n.changeLanguage("en"));
});

describe("Discover More — access", () => {
  it("an admin opens it from the navigation", async () => {
    signInAs("ADMIN");
    renderApp("/pos");
    await screen.findByRole("heading", { level: 1, name: "POS" }, { timeout: 5000 });
    const user = userEvent.setup();
    await user.click(within(navigation()).getByRole("link", { name: "Discover More" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Discover More" }, { timeout: 5000 })).toBeInTheDocument();
    expect(currentPathname()).toBe("/discover");
  });

  it("a cashier has no Discover More link and gets the role notice at /discover", async () => {
    signInAs("CASHER");
    renderApp("/discover");
    expect(await screen.findByText("Not available for your role", undefined, { timeout: 5000 })).toBeInTheDocument();
    expect(within(navigation()).queryByRole("link", { name: "Discover More" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "All planned capabilities" })).not.toBeInTheDocument();
  });
});

describe("Discover More — the catalog", () => {
  it("says up front that everything is planned, unavailable and illustrative", async () => {
    await openDiscover();
    const note = screen.getByRole("note");
    expect(note).toHaveTextContent("planned and not part of your current POS");
    expect(note).toHaveTextContent("illustrative and contain no real data");
    expect(note).toHaveTextContent("No release dates have been set");
  });

  it("shows the featured previews and all 30 planned capabilities in their five areas", async () => {
    await openDiscover();
    const featured = within(screen.getByRole("region", { name: "Featured previews" })).getAllByRole("article");
    expect(featured).toHaveLength(FEATURED.length);
    expect(featured[0]).toHaveTextContent("Recipe Costing");
    expect(featured[0]).toHaveTextContent("Illustrative preview");
    expect(browseCards()).toHaveLength(CAPABILITIES.length);
    expect(CAPABILITIES).toHaveLength(30);
    for (const name of ["Inventory & Purchasing", "Customers & Marketing", "Business Intelligence", "Operations & Staff", "Delivery & Digital Ordering"]) {
      expect(within(browse()).getByRole("heading", { level: 3, name })).toBeInTheDocument();
    }
    expect(screen.getByText("Showing 30 of 30 planned capabilities")).toBeInTheDocument();
  });

  it("every card is labelled Planned and offers no control (no button, no link, no field)", async () => {
    await openDiscover();
    for (const card of screen.getAllByRole("article")) {
      expect(within(card).getByText("Planned")).toBeInTheDocument();
      expect(within(card).queryAllByRole("button")).toHaveLength(0);
      expect(within(card).queryAllByRole("link")).toHaveLength(0);
      expect(within(card).queryAllByRole("textbox")).toHaveLength(0);
    }
    expect(screen.queryByRole("button", { name: /request|access|buy|subscribe|upgrade/i })).not.toBeInTheDocument();
  });

  it("no card claims availability, a date, a price or AI", async () => {
    await openDiscover();
    const text = browse().textContent ?? "";
    expect(text).not.toMatch(/\b(available now|now available|launch(es|ing)? on|release date|JOD|price plan|subscription|AI\b|artificial intelligence)/i);
  });
});

describe("Discover More — filter and search", () => {
  it("an area filter keeps only that area and hides the featured previews", async () => {
    const user = await openDiscover();
    await user.click(screen.getByRole("radio", { name: "Delivery & Digital Ordering" }));
    await waitFor(() => expect(browseCards()).toHaveLength(6));
    expect(screen.queryByRole("region", { name: "Featured previews" })).not.toBeInTheDocument();
    expect(within(browse()).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual(["Delivery & Digital Ordering"]);
    expect(screen.getByText("Showing 6 of 30 planned capabilities")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "All areas" }));
    await waitFor(() => expect(browseCards()).toHaveLength(30));
  });

  it("search matches titles and descriptions; no match shows the empty state with a real reset", async () => {
    const user = await openDiscover();
    const search = screen.getByRole("textbox", { name: "Search planned capabilities" });
    await user.type(search, "loyalty");
    await waitFor(() => expect(browseCards().map((card) => card.querySelector("h4")?.textContent)).toEqual(["Loyalty Points"]));
    await user.clear(search);
    await user.type(search, "zzzz");
    expect(await screen.findByRole("heading", { name: "No planned capability matches your search" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show all" }));
    await waitFor(() => expect(browseCards()).toHaveLength(30));
    expect(search).toHaveValue("");
  });
});

describe("Discover More — Arabic", () => {
  it("renders right to left with Arabic texts; an English word still finds a card", async () => {
    const user = await openDiscover();
    await act(() => i18n.changeLanguage("ar"));
    expect(document.documentElement.dir).toBe("rtl");
    expect(await screen.findByRole("heading", { level: 2, name: "كل الميزات المخطط لها" })).toBeInTheDocument();
    expect(screen.getAllByText("مخطط لها").length).toBeGreaterThanOrEqual(CAPABILITIES.length);
    expect(screen.getByRole("note")).toHaveTextContent("ليس جزءًا من نظامك الحالي");
    await user.type(screen.getByRole("textbox", { name: "ابحث في الميزات المخطط لها" }), "Loyalty");
    await waitFor(() => expect(within(screen.getByRole("region", { name: "كل الميزات المخطط لها" })).getAllByRole("article")).toHaveLength(1));
    expect(CATEGORIES.every((category) => i18n.exists(`discover.categories.${category.id}.title`, { lng: "ar" }))).toBe(true);
  });
});

describe("teasers on existing screens", () => {
  it("Finance ends with a quiet planned note about profit and food cost that links to Discover More", async () => {
    signInAs("ADMIN");
    renderApp("/finance");
    await screen.findByRole("region", { name: "Total sales" }, { timeout: 5000 });
    const teaser = screen.getByRole("complementary", { name: "Profit and food-cost insights" });
    expect(within(teaser).getByText("Planned")).toBeInTheDocument();
    expect(teaser).toHaveTextContent("They are not available yet.");
    expect(within(teaser).getByRole("link", { name: "Explore what's next" })).toHaveAttribute("href", "/discover");
  });

  it("the Menu categories level shows a quiet planned note that links to Discover More", async () => {
    signInAs("ADMIN");
    renderApp("/catalog");
    const teaser = await screen.findByRole("complementary", { name: "Ingredient stock and recipe costing" }, { timeout: 5000 });
    expect(within(teaser).getByText("Planned")).toBeInTheDocument();
    expect(teaser).toHaveTextContent("They are not available yet.");
    const user = userEvent.setup();
    await user.click(within(teaser).getByRole("link", { name: "Explore what's next" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Discover More" }, { timeout: 5000 })).toBeInTheDocument();
  });
});
