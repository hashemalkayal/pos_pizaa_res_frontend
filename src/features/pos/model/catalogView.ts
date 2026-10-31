import type { CatalogCategory, CatalogProduct, CatalogVariant } from "@/api/v2/catalog";
import { fromFils, toFils } from "@/lib/money";

/** A product's add-on as the catalog offers it (one price per product). */
export type ProductAddOn = CatalogProduct["addOns"][number];

/** Variants that can be sold now, in menu order. */
export const sellableVariants = (product: CatalogProduct): CatalogVariant[] =>
  product.variants.filter((variant) => variant.isActive && !variant.archived).sort((a, b) => a.sortOrder - b.sortOrder);

/** The variant preselected in the product dialog: the catalog default, else the first sellable one. */
export const defaultVariant = (product: CatalogProduct): CatalogVariant | undefined => {
  const variants = sellableVariants(product);
  return variants.find((variant) => variant.isDefault) ?? variants[0];
};

/** Lowest sellable price, and whether all variants cost the same (then it is shown without "from"). */
export const startingPrice = (product: CatalogProduct): { price: string; varies: boolean } | null => {
  const prices = sellableVariants(product).map((variant) => toFils(variant.price));
  if (!prices.length) return null;
  const lowest = Math.min(...prices);
  return { price: fromFils(lowest), varies: prices.some((price) => price !== lowest) };
};

/** The option group of the pizza dough (Regular / Whole Wheat). */
export const DOUGH_GROUP = "DOUGH";

/** One dough tab of the product dialog: the sellable variants (sizes) made with that dough, in menu order. */
export interface DoughTab {
  valueId: number;
  nameEn: string;
  nameAr: string;
  variants: CatalogVariant[];
}

const doughOf = (variant: CatalogVariant) => variant.options.find((option) => option.group === DOUGH_GROUP);

/**
 * Dough tabs for products sold in sizes with more than one dough (pizzas), from the catalog's actual variants:
 * a tab lists only the sizes that exist for its dough. Null when the dough is not a separate choice, e.g. a
 * single dough, or manakish, whose only option is the dough (plain option cards are clearer there).
 */
export const doughTabs = (product: CatalogProduct): DoughTab[] | null => {
  const variants = sellableVariants(product);
  if (!variants.some((variant) => variant.unit)) return null;
  const tabs: DoughTab[] = [];
  for (const variant of variants) {
    const dough = doughOf(variant);
    if (!dough) return null;
    const tab = tabs.find((candidate) => candidate.valueId === dough.valueId);
    if (tab) tab.variants.push(variant);
    else tabs.push({ valueId: dough.valueId, nameEn: dough.nameEn, nameAr: dough.nameAr, variants: [variant] });
  }
  const order = product.optionGroups.find((group) => group.code === DOUGH_GROUP)?.values ?? [];
  const position = (tab: DoughTab) => order.find((value) => value.id === tab.valueId)?.sortOrder ?? Number.MAX_SAFE_INTEGER;
  return tabs.length > 1 ? tabs.sort((a, b) => position(a) - position(b)) : null;
};

/** The variant selected when the cashier switches to `tab`: the same size if this dough has it, else its first size. */
export const variantForDough = (tab: DoughTab, current: CatalogVariant | undefined): CatalogVariant =>
  tab.variants.find((variant) => current?.unit && variant.unit?.id === current.unit.id) ?? tab.variants.find((variant) => variant.isDefault) ?? tab.variants[0];

/** A variant's label inside its dough tab: the size and any other option, without the dough ("Medium"). */
export const labelWithoutDough = (variant: CatalogVariant): { en: string; ar: string } => {
  const parts: { nameEn: string; nameAr: string }[] = [
    ...(variant.unit ? [variant.unit] : []),
    ...variant.options.filter((option) => option.group !== DOUGH_GROUP),
  ];
  return { en: parts.map((part) => part.nameEn).join(" · "), ar: parts.map((part) => part.nameAr).join(" · ") };
};

/** Only products with something to sell are shown at the counter. */
export const isSellable = (product: CatalogProduct) => sellableVariants(product).length > 0;

export interface CatalogEntry {
  product: CatalogProduct;
  category: CatalogCategory;
}

/** Product and variant lookups for the cart. */
export interface CatalogIndex {
  products: Map<number, CatalogEntry>;
  variants: Map<number, { variant: CatalogVariant; product: CatalogProduct }>;
}

export const indexCatalog = (categories: CatalogCategory[]): CatalogIndex => {
  const index: CatalogIndex = { products: new Map(), variants: new Map() };
  for (const category of categories) {
    for (const product of category.products) {
      index.products.set(product.id, { product, category });
      for (const variant of product.variants) index.variants.set(variant.id, { variant, product });
    }
  }
  return index;
};

/** `next` plus what only `previous` had: names of products the reloaded menu no longer sells (display only). */
export const mergeIndex = (previous: CatalogIndex | null, next: CatalogIndex): CatalogIndex =>
  previous ? { products: new Map([...previous.products, ...next.products]), variants: new Map([...previous.variants, ...next.variants]) } : next;

/** The add-ons of a product with these ids, in the catalog's order. */
export const selectedAddOns = (product: CatalogProduct, addOnIds: number[]): ProductAddOn[] =>
  product.addOns.filter((addOn) => addOnIds.includes(addOn.addOnId));

/** Case-, accent- and Arabic-letter-form-insensitive text for search (أ/إ/آ → ا, ة → ه, ى → ي, no tashkeel). */
export const normalizeSearch = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f\u064b-\u065f\u0670\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim();

export const matchesSearch = (product: CatalogProduct, query: string) => {
  const needle = normalizeSearch(query);
  return !needle || normalizeSearch(`${product.nameEn} ${product.nameAr}`).includes(needle);
};
