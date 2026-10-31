import type { CatalogCategory, CatalogOptionGroup, CatalogUnit, CatalogVariant } from "@/api/v2/catalog";
import type { MenuAddOn, MenuCategory, MenuProduct, MenuProductDetail } from "@/api/v2/menu";
import { MOCK_CATALOG } from "./fixtures/catalog";
import { MockError } from "./mockError";

/**
 * DEVELOPMENT/TEST ONLY. The menu as the backend keeps it (src/services/catalog), started from MOCK_CATALOG: the
 * POS menu (GET /api/catalog), order pricing and Menu management all read this store, so a change made in Menu
 * management shows in the POS. Deleting is a soft delete (archivedAt, D80).
 */

type Row = { archivedAt: string | null };
type Category = Omit<MenuCategory, "productCount"> & Row;
type Product = Omit<MenuProduct, "category" | "variantCount" | "draft" | "archived"> &
  Row & { descriptionEn: string | null; descriptionAr: string | null; optionGroupIds: number[]; ingredients: { id: number; nameEn: string; nameAr: string }[] };
type AddOn = Omit<MenuAddOn, "products"> & Row;
type Link = { productId: number; addOnId: number; price: string; isActive: boolean; sortOrder: number };

let categories: Category[] = [];
let products: Product[] = [];
let variants: CatalogVariant[] = [];
let addOns: AddOn[] = [];
let links: Link[] = [];
let units: CatalogUnit[] = [];
let optionGroups: CatalogOptionGroup[] = [];
let nextId = 1000;

export const resetMenuStore = () => {
  const allProducts = MOCK_CATALOG.flatMap((category) => category.products.map((product) => ({ category, product })));
  categories = MOCK_CATALOG.map(({ id, nameEn, nameAr, imageUrl, sortOrder }) => ({ id, nameEn, nameAr, imageUrl, sortOrder, isActive: true, archivedAt: null }));
  products = allProducts.map(({ category, product }) => ({
    id: product.id,
    slug: product.slug,
    categoryId: category.id,
    nameEn: product.nameEn,
    nameAr: product.nameAr,
    descriptionEn: product.descriptionEn,
    descriptionAr: product.descriptionAr,
    imageUrl: product.imageUrl,
    usesUnits: product.usesUnits,
    isActive: true,
    sortOrder: 0,
    archivedAt: null,
    optionGroupIds: product.optionGroups.map((group) => group.id),
    ingredients: product.ingredients,
  }));
  variants = allProducts.flatMap(({ product }) => product.variants.map((variant) => structuredClone(variant)));
  const addOnNames = new Map(allProducts.flatMap(({ product }) => product.addOns.map((addOn) => [addOn.addOnId, addOn] as const)));
  addOns = [...addOnNames.values()].map((addOn) => ({ id: addOn.addOnId, nameEn: addOn.nameEn, nameAr: addOn.nameAr, descriptionEn: null, descriptionAr: null, imageUrl: null, isActive: true, archivedAt: null }));
  links = allProducts.flatMap(({ product }) => product.addOns.map((addOn, index) => ({ productId: product.id, addOnId: addOn.addOnId, price: addOn.price, isActive: true, sortOrder: index + 1 })));
  units = [...new Map(variants.flatMap((variant) => (variant.unit ? [[variant.unit.id, variant.unit] as const] : []))).values()].sort((a, b) => a.sortOrder - b.sortOrder);
  optionGroups = [...new Map(allProducts.flatMap(({ product }) => product.optionGroups.map((group) => [group.id, group] as const))).values()];
  nextId = 1000;
};
resetMenuStore();

const now = () => new Date().toISOString();
const live = <T extends Row>(row: T | undefined): row is T => Boolean(row) && !row!.archivedAt;
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const bySort = <T extends { sortOrder: number; id: number }>(a: T, b: T) => a.sortOrder - b.sortOrder || a.id - b.id;
const matchesQuery = (row: { nameEn: string; nameAr: string; slug?: string }, q: string | undefined) =>
  !q?.trim() || [row.nameEn, row.nameAr, row.slug ?? ""].some((text) => text.toLowerCase().includes(q.trim().toLowerCase()));
const paginate = <T>(rows: T[], page = 1, pageSize = 50) => ({
  items: rows.slice((page - 1) * pageSize, page * pageSize),
  pagination: { page, pageSize, total: rows.length, totalPages: Math.max(1, Math.ceil(rows.length / pageSize)) },
});
const notFound = (code: string, what: string) => new MockError(404, code, `${what} not found.`);

const sellable = (variant: CatalogVariant) => variant.isActive && !variant.archived;
const categoryOf = (product: Product) => categories.find((category) => category.id === product.categoryId)!;
const linksOf = (productId: number) => links.filter((link) => link.productId === productId);
const offeredLinks = (productId: number) =>
  linksOf(productId).filter((link) => link.isActive && live(addOns.find((addOn) => addOn.id === link.addOnId)) && addOns.find((addOn) => addOn.id === link.addOnId)!.isActive);
const groupsOf = (product: Product) => optionGroups.filter((group) => product.optionGroupIds.includes(group.id));

// ─── POS menu and order pricing ──────────────────────────────────────────────

/** GET /api/catalog: active, not deleted categories; products with at least one sellable variant (D51). */
export const getMenu = (): CatalogCategory[] =>
  categories
    .filter((category) => category.isActive && live(category))
    .sort(bySort)
    .map((category) => ({
      id: category.id,
      nameEn: category.nameEn,
      nameAr: category.nameAr,
      imageUrl: category.imageUrl,
      sortOrder: category.sortOrder,
      products: products
        .filter((product) => product.categoryId === category.id && product.isActive && live(product))
        .sort(bySort)
        .map((product) => ({ product, sold: variants.filter((variant) => variant.productId === product.id && sellable(variant)).sort(bySort) }))
        .filter(({ sold }) => sold.length > 0)
        .map(({ product, sold }) => ({
          id: product.id,
          slug: product.slug,
          nameEn: product.nameEn,
          nameAr: product.nameAr,
          descriptionEn: product.descriptionEn,
          descriptionAr: product.descriptionAr,
          imageUrl: product.imageUrl,
          usesUnits: product.usesUnits,
          optionGroups: groupsOf(product),
          variants: sold,
          ingredients: product.ingredients,
          addOns: offeredLinks(product.id).map((link) => {
            const addOn = addOns.find((candidate) => candidate.id === link.addOnId)!;
            return { addOnId: addOn.id, nameEn: addOn.nameEn, nameAr: addOn.nameAr, price: link.price };
          }),
        })),
    }));

/** A variant for a new order line (backend assertSellable + resolveAddOns), or the backend's 422. */
export const variantForSale = (variantId: number) => {
  const variant = variants.find((candidate) => candidate.id === variantId);
  if (!variant) throw new MockError(422, "VARIANT_NOT_FOUND", `Variant ${variantId} does not exist.`, { variantId });
  const product = products.find((candidate) => candidate.id === variant.productId)!;
  const category = categoryOf(product);
  if (!sellable(variant) || !product.isActive || !live(product) || !category.isActive || !live(category)) {
    throw new MockError(422, "VARIANT_UNAVAILABLE", `Variant ${variantId} is not available for sale.`, { variantId });
  }
  const addOn = (addOnId: number) => {
    const link = offeredLinks(product.id).find((candidate) => candidate.addOnId === addOnId);
    if (!link) throw new MockError(422, "ADDON_NOT_AVAILABLE", `Add-on ${addOnId} is not available for ${product.nameEn}.`, { addOnId, variantId });
    const row = addOns.find((candidate) => candidate.id === addOnId)!;
    return { addOnId, nameEn: row.nameEn, nameAr: row.nameAr, unitPrice: link.price };
  };
  return { variant, product, category, addOn };
};

// ─── Categories ──────────────────────────────────────────────────────────────

const publicCategory = (category: Category): MenuCategory => ({
  id: category.id,
  nameEn: category.nameEn,
  nameAr: category.nameAr,
  imageUrl: category.imageUrl,
  sortOrder: category.sortOrder,
  isActive: category.isActive,
  productCount: products.filter((product) => product.categoryId === category.id && live(product)).length,
});
const liveCategory = (id: number) => {
  const category = categories.find((candidate) => candidate.id === id);
  if (!live(category)) throw notFound("CATEGORY_NOT_FOUND", "Category");
  return category;
};
const assertCategoryNames = (input: { nameEn?: string; nameAr?: string }, except?: number) => {
  if (categories.some((c) => c.id !== except && ((input.nameEn && sameName(c.nameEn, input.nameEn)) || (input.nameAr && sameName(c.nameAr, input.nameAr))))) {
    throw new MockError(409, "CATEGORY_ALREADY_EXISTS", "A category with this English or Arabic name already exists.");
  }
};

export const listCategories = () => categories.filter(live).sort(bySort).map(publicCategory);

export const createCategory = (input: { nameEn: string; nameAr: string; sortOrder?: number }) => {
  assertCategoryNames(input);
  const category: Category = { id: nextId++, nameEn: input.nameEn.trim(), nameAr: input.nameAr.trim(), imageUrl: null, sortOrder: input.sortOrder ?? 0, isActive: true, archivedAt: null };
  categories.push(category);
  return publicCategory(category);
};

export const updateCategory = (id: number, input: { nameEn?: string; nameAr?: string; sortOrder?: number }) => {
  const category = liveCategory(id);
  assertCategoryNames(input, id);
  Object.assign(category, { ...(input.nameEn ? { nameEn: input.nameEn.trim() } : {}), ...(input.nameAr ? { nameAr: input.nameAr.trim() } : {}), ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}) });
  return publicCategory(category);
};

export const archiveCategory = (id: number) => {
  const category = liveCategory(id);
  const count = products.filter((product) => product.categoryId === id && live(product)).length;
  if (count) throw new MockError(409, "CATEGORY_HAS_PRODUCTS", "The category still has products. Move or delete them first.", { products: count });
  category.archivedAt = now();
  return { id };
};

// ─── Products ────────────────────────────────────────────────────────────────

const productSummary = (product: Product): MenuProduct => {
  const kept = variants.filter((variant) => variant.productId === product.id && !variant.archived);
  const category = categoryOf(product);
  return {
    id: product.id,
    slug: product.slug,
    categoryId: product.categoryId,
    category: { id: category.id, nameEn: category.nameEn, nameAr: category.nameAr, isActive: category.isActive },
    nameEn: product.nameEn,
    nameAr: product.nameAr,
    imageUrl: product.imageUrl,
    usesUnits: product.usesUnits,
    isActive: product.isActive,
    sortOrder: product.sortOrder,
    archived: Boolean(product.archivedAt),
    variantCount: kept.length,
    draft: !kept.some((variant) => variant.isActive),
  };
};
const productDetail = (product: Product): MenuProductDetail => ({
  ...productSummary(product),
  descriptionEn: product.descriptionEn,
  descriptionAr: product.descriptionAr,
  optionGroups: groupsOf(product),
  variants: variants.filter((variant) => variant.productId === product.id).sort(bySort),
  addOns: linksOf(product.id)
    .filter((link) => live(addOns.find((addOn) => addOn.id === link.addOnId)))
    .map((link) => {
      const addOn = addOns.find((candidate) => candidate.id === link.addOnId)!;
      return { addOnId: addOn.id, nameEn: addOn.nameEn, nameAr: addOn.nameAr, addOnIsActive: addOn.isActive, price: link.price, isActive: link.isActive, sortOrder: link.sortOrder };
    }),
});
const findProduct = (id: number) => {
  const product = products.find((candidate) => candidate.id === id);
  if (!product) throw notFound("PRODUCT_NOT_FOUND", "Product");
  return product;
};
const assertProductName = (categoryId: number, input: { nameEn?: string; nameAr?: string }, except?: number) => {
  const clash = products.some(
    (p) => p.id !== except && p.categoryId === categoryId && ((input.nameEn && sameName(p.nameEn, input.nameEn)) || (input.nameAr && sameName(p.nameAr, input.nameAr)))
  );
  if (clash) throw new MockError(409, "PRODUCT_ALREADY_EXISTS", "A product with this name already exists in the category.");
};

export const listProducts = (query: { categoryId?: number; q?: string; page?: number; pageSize?: number }) =>
  paginate(
    products
      .filter((product) => live(product) && (query.categoryId === undefined || product.categoryId === query.categoryId) && matchesQuery(product, query.q))
      .sort((a, b) => a.categoryId - b.categoryId || bySort(a, b))
      .map(productSummary),
    query.page,
    query.pageSize
  );

export const getProduct = (id: number) => productDetail(findProduct(id));

type ProductBody = { categoryId: number; nameEn: string; nameAr: string; descriptionEn?: string | null; descriptionAr?: string | null; sortOrder?: number; usesUnits?: boolean; optionGroupIds?: number[] };

export const createProduct = (input: ProductBody) => {
  if (!live(categories.find((category) => category.id === input.categoryId))) throw new MockError(422, "CATEGORY_NOT_FOUND", `Category ${input.categoryId} does not exist.`);
  assertProductName(input.categoryId, input);
  const id = nextId++;
  const product: Product = {
    id,
    slug: `${input.nameEn.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "product"}-${id}`,
    categoryId: input.categoryId,
    nameEn: input.nameEn.trim(),
    nameAr: input.nameAr.trim(),
    descriptionEn: input.descriptionEn ?? null,
    descriptionAr: input.descriptionAr ?? null,
    imageUrl: null,
    usesUnits: Boolean(input.usesUnits),
    isActive: true,
    sortOrder: input.sortOrder ?? 0,
    archivedAt: null,
    optionGroupIds: input.optionGroupIds ?? [],
    ingredients: [],
  };
  products.push(product);
  return productDetail(product);
};

/** D49: sizes and option groups are locked once the product has a variant (deleted ones included). */
export const updateProduct = (id: number, input: Partial<ProductBody>) => {
  const product = findProduct(id);
  const hasVariants = variants.some((variant) => variant.productId === id);
  const groupsChanged = input.optionGroupIds !== undefined && [...input.optionGroupIds].sort().join() !== [...product.optionGroupIds].sort().join();
  if (hasVariants && ((input.usesUnits !== undefined && input.usesUnits !== product.usesUnits) || groupsChanged)) {
    throw new MockError(409, "PRODUCT_STRUCTURE_LOCKED", "Option groups and units cannot change after the product has variants.");
  }
  if (input.categoryId !== undefined && !live(categories.find((category) => category.id === input.categoryId))) {
    throw new MockError(422, "CATEGORY_NOT_FOUND", `Category ${input.categoryId} does not exist.`);
  }
  assertProductName(input.categoryId ?? product.categoryId, input, id);
  for (const key of ["categoryId", "nameEn", "nameAr", "descriptionEn", "descriptionAr", "sortOrder", "usesUnits", "optionGroupIds"] as const) {
    if (input[key] !== undefined) Object.assign(product, { [key]: typeof input[key] === "string" ? (input[key] as string).trim() : input[key] });
  }
  return productDetail(product);
};

export const archiveProduct = (id: number) => {
  const product = findProduct(id);
  product.archivedAt = now();
  return productDetail(product);
};

// ─── Variants ────────────────────────────────────────────────────────────────

export const listVariants = (productId: number) => {
  findProduct(productId);
  return variants.filter((variant) => variant.productId === productId && !variant.archived).sort(bySort);
};

const findVariant = (productId: number, variantId: number) => {
  const variant = variants.find((candidate) => candidate.id === variantId && candidate.productId === productId);
  if (!variant) throw notFound("VARIANT_NOT_FOUND", "Variant");
  return variant;
};
const setDefault = (productId: number, variantId: number) => {
  for (const variant of variants) if (variant.productId === productId) variant.isDefault = variant.id === variantId;
};

type VariantBody = { unitId?: number | null; optionValueIds?: number[]; price: string; isDefault?: boolean; sortOrder?: number };

/** A combination that exists → 409; a deleted one is brought back with the new values (D80). */
export const createVariant = (productId: number, input: VariantBody) => {
  const product = findProduct(productId);
  const unit = input.unitId ? units.find((candidate) => candidate.id === input.unitId) : null;
  if (product.usesUnits && !unit) throw new MockError(422, "UNIT_REQUIRED", "This product uses units: choose a unit.");
  if (!product.usesUnits && input.unitId) throw new MockError(422, "UNIT_NOT_ALLOWED", "This product does not use units.");
  const values = (input.optionValueIds ?? []).map((valueId) => optionGroups.flatMap((group) => group.values).find((value) => value.id === valueId));
  if (values.some((value) => !value) || values.map((value) => value!.optionGroupId).sort().join() !== [...product.optionGroupIds].sort().join()) {
    throw new MockError(422, "OPTION_SELECTION_INCOMPLETE", "Choose exactly one value for every option group of this product.");
  }
  const options = values
    .map((value) => ({ groupId: value!.optionGroupId, group: optionGroups.find((group) => group.id === value!.optionGroupId)!.code, valueId: value!.id, value: value!.code, nameEn: value!.nameEn, nameAr: value!.nameAr }))
    .sort((a, b) => a.groupId - b.groupId);
  const key = `U${unit?.id ?? 0}${options.map((option) => `;G${option.groupId}=${option.valueId}`).join("")}`;
  const keyOf = (variant: CatalogVariant) => `U${variant.unit?.id ?? 0}${variant.options.map((option) => `;G${option.groupId}=${option.valueId}`).join("")}`;
  const existing = variants.find((variant) => variant.productId === productId && keyOf(variant) === key);
  if (existing && !existing.archived) throw new MockError(409, "VARIANT_ALREADY_EXISTS", "A variant with this combination already exists; its price was not changed.", { existingVariantId: existing.id });
  const labelEn = [unit?.nameEn, ...options.map((option) => option.nameEn)].filter(Boolean).join(" · ") || null;
  const labelAr = [unit?.nameAr, ...options.map((option) => option.nameAr)].filter(Boolean).join(" · ") || null;
  const variant: CatalogVariant = existing ?? {
    id: nextId++,
    productId,
    sku: [product.slug, unit?.code, ...options.map((option) => option.value)].filter(Boolean).join("-").toUpperCase(),
    unit: unit ?? null,
    options,
    labelEn,
    labelAr,
    price: input.price,
    isActive: true,
    isDefault: false,
    sortOrder: 0,
    archived: false,
    archivedAt: null,
  };
  Object.assign(variant, { price: input.price, isActive: true, isDefault: false, sortOrder: input.sortOrder ?? 0, archived: false, archivedAt: null });
  if (!existing) variants.push(variant);
  if (input.isDefault) setDefault(productId, variant.id);
  return variant;
};

export const updateVariant = (productId: number, variantId: number, input: Partial<VariantBody>) => {
  const variant = findVariant(productId, variantId);
  if (input.unitId !== undefined || input.optionValueIds !== undefined) {
    throw new MockError(422, "VARIANT_IDENTITY_IMMUTABLE", "A variant's product, unit and options cannot change. Create another variant instead.");
  }
  if (input.price !== undefined) variant.price = input.price;
  if (input.sortOrder !== undefined) variant.sortOrder = input.sortOrder;
  if (input.isDefault === true) setDefault(productId, variantId);
  if (input.isDefault === false) variant.isDefault = false;
  return variant;
};

export const archiveVariant = (productId: number, variantId: number) => {
  const variant = findVariant(productId, variantId);
  Object.assign(variant, { archived: true, archivedAt: now() });
  return variant;
};

// ─── Add-ons ─────────────────────────────────────────────────────────────────

const publicAddOn = ({ id, nameEn, nameAr, descriptionEn, descriptionAr, imageUrl, isActive }: AddOn): MenuAddOn => ({ id, nameEn, nameAr, descriptionEn, descriptionAr, imageUrl, isActive });
const liveAddOn = (id: number) => {
  const addOn = addOns.find((candidate) => candidate.id === id);
  if (!live(addOn)) throw notFound("ADDON_NOT_FOUND", "Add-on");
  return addOn;
};
const assertAddOnNames = (input: { nameEn?: string; nameAr?: string }, except?: number) => {
  if (addOns.some((a) => a.id !== except && ((input.nameEn && sameName(a.nameEn, input.nameEn)) || (input.nameAr && sameName(a.nameAr, input.nameAr))))) {
    throw new MockError(409, "ADDON_ALREADY_EXISTS", "An add-on with this English or Arabic name already exists.");
  }
};

export const listAddOns = (query: { q?: string; page?: number; pageSize?: number }) =>
  paginate(addOns.filter((addOn) => live(addOn) && matchesQuery(addOn, query.q)).sort((a, b) => a.nameEn.localeCompare(b.nameEn)).map(publicAddOn), query.page, query.pageSize);

export const getAddOn = (id: number): MenuAddOn => ({
  ...publicAddOn(liveAddOn(id)),
  products: links
    .filter((link) => link.addOnId === id && live(products.find((product) => product.id === link.productId)))
    .sort((a, b) => a.productId - b.productId)
    .map((link) => {
      const product = products.find((candidate) => candidate.id === link.productId)!;
      return { productId: product.id, productNameEn: product.nameEn, productNameAr: product.nameAr, price: link.price, isActive: link.isActive };
    }),
});

type AddOnBody = { nameEn: string; nameAr: string; descriptionEn?: string | null; descriptionAr?: string | null };

export const createAddOn = (input: AddOnBody) => {
  assertAddOnNames(input);
  const addOn: AddOn = { id: nextId++, nameEn: input.nameEn.trim(), nameAr: input.nameAr.trim(), descriptionEn: input.descriptionEn ?? null, descriptionAr: input.descriptionAr ?? null, imageUrl: null, isActive: true, archivedAt: null };
  addOns.push(addOn);
  return publicAddOn(addOn);
};

export const updateAddOn = (id: number, input: Partial<AddOnBody>) => {
  const addOn = liveAddOn(id);
  assertAddOnNames(input, id);
  for (const key of ["nameEn", "nameAr", "descriptionEn", "descriptionAr"] as const) {
    if (input[key] !== undefined) addOn[key] = (typeof input[key] === "string" ? (input[key] as string).trim() : input[key]) as never;
  }
  return getAddOn(id);
};

export const archiveAddOn = (id: number) => {
  liveAddOn(id).archivedAt = now();
  return { id };
};

/** PUT /api/products/:id/add-ons/:addOnId: the add-on's price on that product; isActive false stops offering it there. */
export const setProductAddOn = (productId: number, addOnId: number, input: { price: string; isActive?: boolean }) => {
  findProduct(productId);
  const addOn = addOns.find((candidate) => candidate.id === addOnId);
  if (!live(addOn)) throw new MockError(422, "ADDON_NOT_FOUND", `Add-on ${addOnId} does not exist.`);
  const link = links.find((candidate) => candidate.productId === productId && candidate.addOnId === addOnId);
  if (link) Object.assign(link, { price: input.price, ...(input.isActive !== undefined ? { isActive: input.isActive } : {}) });
  else links.push({ productId, addOnId, price: input.price, isActive: input.isActive ?? true, sortOrder: linksOf(productId).length + 1 });
  return productDetail(findProduct(productId)).addOns;
};

// ─── Reference data ──────────────────────────────────────────────────────────

export const listUnits = () => units;
export const listOptionGroups = () => optionGroups;
