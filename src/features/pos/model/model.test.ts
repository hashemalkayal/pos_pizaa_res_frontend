import { describe, expect, it } from "vitest";
import type { CatalogProduct } from "@/api/catalog";
import type { Customer } from "@/api/customers";
import { MOCK_CATALOG } from "@/mocks/fixtures/catalog";
import { canAddLine, canAddLines, cartReducer, itemCount, MAX_LINES, type CartLine, type LineConfig } from "./cart";
import { doughTabs, labelWithoutDough, matchesSearch, normalizeSearch, sellableVariants, startingPrice, variantForDough } from "./catalogView";
import { formatDeliveryTime, isTimePickerValue } from "./deliveryTime";
import { buildCreateOrderRequest, draftProblems, EMPTY_DRAFT, pricingAdjustments, type OrderDraft } from "./orderDraft";
import { cashState, quickCashAmounts } from "./payment";

const config = (overrides: Partial<LineConfig> = {}): LineConfig => ({ productId: 1, variantId: 101, addOnIds: [], quantity: 1, comment: null, ...overrides });
const add = (lines: CartLine[], key: string, line: LineConfig) => cartReducer(lines, { type: "add", key, line });

describe("cart", () => {
  it("merges identical lines: same variant, same add-ons in any order, same note after trimming", () => {
    let lines = add([], "a", config({ addOnIds: [2, 1], comment: "  no onions " }));
    lines = add(lines, "b", config({ addOnIds: [1, 2], comment: "no onions", quantity: 2 }));
    expect(lines).toEqual([{ key: "a", productId: 1, variantId: 101, addOnIds: [1, 2], quantity: 3, comment: "no onions" }]);
  });

  it("keeps lines apart when the variant, the add-ons or the note differ", () => {
    let lines = add([], "a", config());
    lines = add(lines, "b", config({ variantId: 102 }));
    lines = add(lines, "c", config({ addOnIds: [1] }));
    lines = add(lines, "d", config({ comment: "well done" }));
    expect(lines.map((line) => line.key)).toEqual(["a", "b", "c", "d"]);
    expect(itemCount(lines)).toBe(4);
  });

  it("an empty note is no note, and a duplicated add-on counts once", () => {
    const lines = add(add([], "a", config({ comment: "   ", addOnIds: [3, 3] })), "b", config({ addOnIds: [3] }));
    expect(lines).toEqual([expect.objectContaining({ key: "a", comment: null, addOnIds: [3], quantity: 2 })]);
  });

  it("quantity stays within 1–99", () => {
    let lines = add([], "a", config({ quantity: 98 }));
    lines = add(lines, "b", config({ quantity: 5 }));
    expect(lines[0].quantity).toBe(99);
    expect(cartReducer(lines, { type: "setQuantity", key: "a", quantity: 0 })[0].quantity).toBe(1);
    expect(cartReducer(lines, { type: "setQuantity", key: "a", quantity: 150 })[0].quantity).toBe(99);
  });

  it("editing a line keeps its key and position", () => {
    let lines = add(add([], "a", config()), "b", config({ variantId: 236, productId: 31 }));
    lines = cartReducer(lines, { type: "update", key: "a", line: config({ variantId: 102, addOnIds: [2], quantity: 3, comment: "cut in 8" }) });
    expect(lines.map((line) => line.key)).toEqual(["a", "b"]);
    expect(lines[0]).toEqual({ key: "a", productId: 1, variantId: 102, addOnIds: [2], quantity: 3, comment: "cut in 8" });
  });

  it("an edit that makes a line identical to another merges them", () => {
    let lines = add(add([], "a", config({ quantity: 2 })), "b", config({ variantId: 102 }));
    lines = cartReducer(lines, { type: "update", key: "b", line: config({ quantity: 3 }) });
    expect(lines).toEqual([expect.objectContaining({ key: "a", variantId: 101, quantity: 5 })]);
  });

  it("removes and clears", () => {
    const lines = add(add([], "a", config()), "b", config({ variantId: 102 }));
    expect(cartReducer(lines, { type: "remove", key: "a" }).map((line) => line.key)).toEqual(["b"]);
    expect(cartReducer(lines, { type: "clear" })).toEqual([]);
  });

  it("at most 50 distinct lines (the backend's limit), but an identical line still merges", () => {
    let lines: CartLine[] = [];
    for (let index = 0; index < MAX_LINES; index += 1) lines = add(lines, `k${index}`, config({ comment: `note ${index}` }));
    expect(canAddLine(lines, config({ comment: "one more" }))).toBe(false);
    expect(add(lines, "extra", config({ comment: "one more" }))).toHaveLength(MAX_LINES);
    expect(canAddLine(lines, config({ comment: "note 3" }))).toBe(true);
    expect(add(lines, "extra", config({ comment: "note 3" }))[3].quantity).toBe(2);
  });

  it("addMany adds several configurations in one update, merging identical ones with each other and with the cart", () => {
    const cart = add([], "a", config());
    const next = cartReducer(cart, {
      type: "addMany",
      lines: [
        { key: "b", line: config({ variantId: 102 }) },
        { key: "c", line: config({ quantity: 2 }) }, // identical to the cart line "a"
        { key: "d", line: config({ variantId: 103, addOnIds: [2] }) },
        { key: "e", line: config({ variantId: 102 }) }, // identical to "b" in the same batch
      ],
    });
    expect(next.map((line) => [line.key, line.variantId, line.quantity])).toEqual([
      ["a", 101, 3],
      ["b", 102, 2],
      ["d", 103, 1],
    ]);
    expect(cart).toHaveLength(1); // the previous state is untouched
  });

  it("canAddLines: all configurations must fit together (identical ones count once)", () => {
    let lines: CartLine[] = [];
    for (let index = 0; index < MAX_LINES - 1; index += 1) lines = add(lines, `k${index}`, config({ comment: `note ${index}` }));
    expect(canAddLines(lines, [config({ comment: "new" }), config({ comment: "new" })])).toBe(true);
    expect(canAddLines(lines, [config({ comment: "new" }), config({ comment: "other" })])).toBe(false);
    expect(canAddLines(lines, [config({ comment: "note 1" }), config({ comment: "new" })])).toBe(true);
  });
});

describe("delivery time (TimePicker → the text printed on the receipt)", () => {
  it.each([
    ["19:30", "7:30 PM"],
    ["07:05", "7:05 AM"],
    ["00:00", "12:00 AM"],
    ["12:00", "12:00 PM"],
    ["23:59", "11:59 PM"],
    ["13:15:00", "1:15 PM"],
  ])("%s → %s", (value, printed) => {
    expect(isTimePickerValue(value)).toBe(true);
    expect(formatDeliveryTime(value)).toBe(printed);
  });

  it("empty is no time; anything else is rejected", () => {
    expect(formatDeliveryTime("")).toBeNull();
    for (const value of ["24:00", "7:30", "19:60", "7:30 PM", "abc"]) {
      expect(isTimePickerValue(value)).toBe(false);
      expect(() => formatDeliveryTime(value)).toThrow(RangeError);
    }
  });
});

describe("order draft → backend requests", () => {
  const lines: CartLine[] = [
    { key: "a", productId: 1, variantId: 101, addOnIds: [1, 2], quantity: 2, comment: "well done" },
    { key: "b", productId: 56, variantId: 99, addOnIds: [], quantity: 1, comment: null },
  ];
  const customer: Customer = { id: 7, name: "Mock Customer", phone: "0790000001", createdAt: "2026-10-01T09:00:00.000Z" };
  const delivery: OrderDraft = { ...EMPTY_DRAFT, serviceType: "DELIVERY", delivery: { location: "  Building 5, Street 9 ", time: "19:30", timeIncomplete: false, fee: "1.500" } };

  it("items carry the variant, quantity, add-ons and note only; the total shown is sent as expectedTotal (never a price)", () => {
    expect(buildCreateOrderRequest(lines, EMPTY_DRAFT, "CASH", "12.500")).toEqual({
      items: [
        { variantId: 101, quantity: 2, addOnIds: [1, 2], comment: "well done" },
        { variantId: 99, quantity: 1 },
      ],
      paymentMethod: "CASH",
      expectedTotal: "12.500",
    });
  });

  it("dine-in never sends or prices delivery values, even when they were typed before switching", () => {
    const dineIn = { ...delivery, serviceType: "DINE_IN" as const };
    expect(draftProblems(dineIn)).toEqual([]);
    expect(pricingAdjustments(dineIn)).toEqual({});
    expect(buildCreateOrderRequest(lines, dineIn, "CASH", "1.000")).not.toHaveProperty("delivery");
  });

  it("delivery: address, printed time and the typed fee", () => {
    expect(pricingAdjustments(delivery)).toEqual({ deliveryPrice: "1.500" });
    expect(buildCreateOrderRequest(lines, delivery, "VISA", "2.500")).toEqual({
      items: expect.any(Array),
      paymentMethod: "VISA",
      delivery: { location: "Building 5, Street 9", time: "7:30 PM", price: "1.500" },
      expectedTotal: "2.500",
    });
    expect(buildCreateOrderRequest(lines, { ...delivery, delivery: { ...delivery.delivery, time: "" } }, "CASH", "2.500").delivery?.time).toBeNull();
  });

  it("a zero delivery fee is a valid fee", () => {
    const free = { ...delivery, delivery: { ...delivery.delivery, fee: "0" } };
    expect(draftProblems(free)).toEqual([]);
    expect(buildCreateOrderRequest(lines, free, "CASH", "1.000").delivery?.price).toBe("0");
  });

  it("delivery needs an address and a fee; a bad fee or time blocks checkout", () => {
    const empty: OrderDraft = { ...EMPTY_DRAFT, serviceType: "DELIVERY" };
    expect(draftProblems(empty)).toEqual(["deliveryLocationRequired", "deliveryFeeRequired"]);
    expect(draftProblems({ ...delivery, delivery: { ...delivery.delivery, fee: "1.5555" } })).toEqual(["deliveryFeeInvalid"]);
    expect(draftProblems({ ...delivery, delivery: { ...delivery.delivery, fee: "-1" } })).toEqual(["deliveryFeeInvalid"]);
    expect(draftProblems({ ...delivery, delivery: { ...delivery.delivery, time: "25:00" } })).toEqual(["deliveryTimeInvalid"]);
    // A partly typed time (e.g. 7:30 without AM/PM) is never dropped silently.
    expect(draftProblems({ ...delivery, delivery: { ...delivery.delivery, time: "", timeIncomplete: true } })).toEqual(["deliveryTimeInvalid"]);
    expect(draftProblems({ ...delivery, serviceType: "DINE_IN", delivery: { ...delivery.delivery, time: "", timeIncomplete: true } })).toEqual([]);
    expect(pricingAdjustments({ ...delivery, delivery: { ...delivery.delivery, fee: "1.5555" } })).toEqual({});
  });

  it("discount: a percentage only, priced and sent when valid and above zero", () => {
    expect(pricingAdjustments({ ...EMPTY_DRAFT, discountPercent: "12.5" })).toEqual({ discountPercent: "12.5" });
    expect(pricingAdjustments({ ...EMPTY_DRAFT, discountPercent: "0" })).toEqual({});
    expect(pricingAdjustments({ ...EMPTY_DRAFT, discountPercent: "100" })).toEqual({ discountPercent: "100" });
    expect(buildCreateOrderRequest(lines, { ...EMPTY_DRAFT, discountPercent: "12.5" }, "CASH", "1.000").discountPercent).toBe("12.5");
    expect(draftProblems({ ...EMPTY_DRAFT, discountPercent: "101" })).toEqual(["discountInvalid"]);
    expect(draftProblems({ ...EMPTY_DRAFT, discountPercent: "10.555" })).toEqual(["discountInvalid"]);
    expect(pricingAdjustments({ ...EMPTY_DRAFT, discountPercent: "101" })).toEqual({});
  });

  it("the customer is optional and sent by id", () => {
    expect(buildCreateOrderRequest(lines, EMPTY_DRAFT, "CASH", "1.000")).not.toHaveProperty("customerId");
    expect(buildCreateOrderRequest(lines, { ...EMPTY_DRAFT, customer }, "CLIQ", "1.000")).toMatchObject({ customerId: 7, paymentMethod: "CLIQ" });
    expect(buildCreateOrderRequest(lines, { ...EMPTY_DRAFT, customer }, "CLIQ", "1.000")).not.toHaveProperty("customer");
  });
});

describe("cash payment (exact fils)", () => {
  it("change, exact amount and insufficient cash", () => {
    expect(cashState(7450, "10")).toEqual({ receivedFils: 10000, changeFils: 2550, sufficient: true });
    expect(cashState(7450, "7.450")).toEqual({ receivedFils: 7450, changeFils: 0, sufficient: true });
    expect(cashState(7450, "7.449")).toEqual({ receivedFils: 7449, changeFils: -1, sufficient: false });
  });

  it("nothing or an invalid amount is never sufficient", () => {
    for (const value of ["", "  ", "abc", "7.4501", "-10"]) expect(cashState(7450, value)).toEqual({ receivedFils: null, changeFils: null, sufficient: false });
  });

  it("quick amounts: exact, then the next 1 / 5 / 10 / 20 / 50 JOD", () => {
    expect(quickCashAmounts(7450)).toEqual([7450, 8000, 10000, 20000, 50000]);
    expect(quickCashAmounts(10000)).toEqual([10000, 20000, 50000]);
    expect(quickCashAmounts(500)).toEqual([500, 1000, 5000, 10000, 20000]);
  });
});

describe("catalog view", () => {
  const margherita = MOCK_CATALOG[0].products[0];
  const water = MOCK_CATALOG.flatMap((category) => category.products).find((product) => product.nameEn === "Water")!;

  it("starting price: the lowest sellable price, and whether it varies", () => {
    expect(startingPrice(margherita)).toEqual({ price: "4.000", varies: true });
    expect(startingPrice(water)).toEqual({ price: "0.500", varies: false });
  });

  it("inactive and archived variants are not sold", () => {
    const product: CatalogProduct = {
      ...margherita,
      variants: [{ ...margherita.variants[0], isActive: false }, { ...margherita.variants[1], archived: true }, margherita.variants[2]],
    };
    expect(sellableVariants(product).map((variant) => variant.id)).toEqual([103]);
    expect(startingPrice(product)).toEqual({ price: "5.000", varies: false });
  });

  it("search ignores case, Arabic letter forms and diacritics", () => {
    expect(matchesSearch(margherita, "MARG")).toBe(true);
    expect(matchesSearch(margherita, "مارجريتا")).toBe(true);
    expect(normalizeSearch("أَحْمَد  إبراهيم")).toBe(normalizeSearch("احمد ابراهيم"));
    expect(normalizeSearch("مدرسة")).toBe(normalizeSearch("مدرسه"));
    expect(matchesSearch(water, "pizza")).toBe(false);
    expect(matchesSearch(water, "  ")).toBe(true);
  });
});

describe("dough tabs (pizzas sold in sizes with several doughs)", () => {
  const products = MOCK_CATALOG.flatMap((category) => category.products);
  const product = (name: string) => products.find((candidate) => candidate.nameEn === name)!;
  const margherita = product("Margherita");

  it("one tab per dough, each with the sizes that exist for it", () => {
    const tabs = doughTabs(margherita)!;
    expect(tabs.map((tab) => [tab.nameEn, tab.nameAr, tab.variants.map((variant) => variant.id)])).toEqual([
      ["Regular", "عادية", [101, 102]],
      ["Whole Wheat", "قمح كامل", [103]],
    ]);
    expect(labelWithoutDough(tabs[0].variants[1])).toEqual({ en: "Large", ar: "كبير" });
  });

  it("the catalog's other pizza shape: Large regular and Medium whole wheat only", () => {
    const tabs = doughTabs({ ...margherita, variants: [margherita.variants[1], margherita.variants[2]] })!;
    expect(tabs.map((tab) => tab.variants.map((variant) => variant.id))).toEqual([[102], [103]]);
  });

  it("no tabs without sizes or without a second dough", () => {
    expect(doughTabs(product("Za'atar"))).toBeNull(); // the dough is the only option
    expect(doughTabs(product("Penne Pesto"))).toBeNull(); // pasta type, not dough
    expect(doughTabs(product("Water"))).toBeNull();
    expect(doughTabs({ ...margherita, variants: margherita.variants.slice(0, 2) })).toBeNull(); // regular only
    expect(doughTabs({ ...margherita, variants: [margherita.variants[0], { ...margherita.variants[2], archived: true }] })).toBeNull();
  });

  it("switching dough keeps the size when that dough has it, else takes its first size", () => {
    const [regular, wholeWheat] = doughTabs(margherita)!;
    const [medium, large] = regular.variants;
    expect(variantForDough(wholeWheat, large).id).toBe(103); // no large whole wheat → medium
    expect(variantForDough(regular, wholeWheat.variants[0]).id).toBe(medium.id); // medium stays medium
    expect(variantForDough(regular, undefined).id).toBe(medium.id);
  });
});
