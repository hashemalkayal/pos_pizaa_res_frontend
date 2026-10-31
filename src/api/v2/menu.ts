import { http, unwrap, type ApiEnvelope } from "../http";
import type { CatalogOptionGroup, CatalogUnit, CatalogVariant, Money } from "./catalog";
import type { Page } from "./orders";

/**
 * Menu management (backend: src/services/catalog, D80). Changes are ADMIN only (403 otherwise); reading is open to
 * every signed-in user. "Delete" is always a soft delete (the archive routes): deleted items leave these lists, the
 * POS menu and new order lines, and orders keep their own snapshot.
 */

export interface MenuCategory {
  id: number;
  nameEn: string;
  nameAr: string;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  /** Products not deleted. */
  productCount?: number;
}

export interface MenuProduct {
  id: number;
  slug: string;
  categoryId: number;
  category?: { id: number; nameEn: string; nameAr: string; isActive: boolean };
  nameEn: string;
  nameAr: string;
  imageUrl: string | null;
  /** Sold in sizes (units): every variant has a unit. Locked once the product has a variant (D49). */
  usesUnits: boolean;
  isActive: boolean;
  sortOrder: number;
  archived: boolean;
  variantCount?: number;
  /** No sellable variant yet: not shown in the POS (D51). */
  draft?: boolean;
}

export interface MenuProductDetail extends MenuProduct {
  descriptionEn: string | null;
  descriptionAr: string | null;
  /** e.g. DOUGH, PASTA_TYPE. Locked once the product has a variant (D49). */
  optionGroups: CatalogOptionGroup[];
  /** Every variant, deleted (archived) ones included. */
  variants: CatalogVariant[];
  addOns: { addOnId: number; nameEn: string; nameAr: string; addOnIsActive: boolean; price: Money; isActive: boolean; sortOrder: number }[];
}

export interface MenuAddOn {
  id: number;
  nameEn: string;
  nameAr: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  imageUrl: string | null;
  isActive: boolean;
  /** Details only: the products it is linked to, each with its own price. */
  products?: { productId: number; productNameEn: string; productNameAr: string; price: Money; isActive: boolean }[];
}

export interface CategoryInput {
  nameEn: string;
  nameAr: string;
  sortOrder: number;
}

export interface ProductInput {
  categoryId: number;
  nameEn: string;
  nameAr: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  sortOrder: number;
  /** Structure: sent only while the product has no variant. */
  usesUnits?: boolean;
  optionGroupIds?: number[];
}

export interface VariantInput {
  price: Money;
  isDefault: boolean;
  sortOrder: number;
  /** Identity: sent on create only (immutable afterwards). */
  unitId?: number | null;
  optionValueIds?: number[];
}

export interface AddOnInput {
  nameEn: string;
  nameAr: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
}

const get = async <T>(url: string, params?: object, signal?: AbortSignal) => unwrap(await http.get<ApiEnvelope<T>>(url, { params, signal }));
const post = async <T>(url: string, body?: unknown) => unwrap(await http.post<ApiEnvelope<T>>(url, body));
const patch = async <T>(url: string, body: unknown) => unwrap(await http.patch<ApiEnvelope<T>>(url, body));
const put = async <T>(url: string, body: unknown) => unwrap(await http.put<ApiEnvelope<T>>(url, body));

// ─── Categories (all of them: a short list, in menu order) ───
export const listMenuCategories = (signal?: AbortSignal) => get<MenuCategory[]>("/categories", { includeInactive: true }, signal);
export const createCategory = (body: CategoryInput) => post<MenuCategory>("/categories", body);
export const updateCategory = (id: number, body: CategoryInput) => patch<MenuCategory>(`/categories/${id}`, body);
/** 409 CATEGORY_HAS_PRODUCTS while the category still has products. */
export const deleteCategory = (id: number) => post<{ id: number }>(`/categories/${id}/archive`);

// ─── Products ───
export const listMenuProducts = (query: { categoryId?: number; q?: string; page?: number; pageSize?: number }, signal?: AbortSignal) =>
  get<Page<MenuProduct>>("/products", query, signal);
export const getMenuProduct = (id: number, signal?: AbortSignal) => get<MenuProductDetail>(`/products/${id}`, undefined, signal);
export const createProduct = (body: ProductInput) => post<MenuProductDetail>("/products", body);
export const updateProduct = (id: number, body: ProductInput) => patch<MenuProductDetail>(`/products/${id}`, body);
export const deleteProduct = (id: number) => post<MenuProductDetail>(`/products/${id}/archive`);

// ─── Variants (per product; deleted ones are left out) ───
export const listVariants = (productId: number, signal?: AbortSignal) => get<CatalogVariant[]>(`/products/${productId}/variants`, undefined, signal);
/** 409 VARIANT_ALREADY_EXISTS for a combination the product already sells. */
export const createVariant = (productId: number, body: VariantInput) => post<CatalogVariant>(`/products/${productId}/variants`, body);
export const updateVariant = (productId: number, variantId: number, body: VariantInput) => patch<CatalogVariant>(`/products/${productId}/variants/${variantId}`, body);
export const deleteVariant = (productId: number, variantId: number) => post<CatalogVariant>(`/products/${productId}/variants/${variantId}/archive`);

// ─── Add-ons ───
export const listMenuAddOns = (query: { q?: string; page?: number; pageSize?: number }, signal?: AbortSignal) => get<Page<MenuAddOn>>("/add-ons", query, signal);
export const getMenuAddOn = (id: number, signal?: AbortSignal) => get<MenuAddOn>(`/add-ons/${id}`, undefined, signal);
export const createAddOn = (body: AddOnInput) => post<MenuAddOn>("/add-ons", body);
export const updateAddOn = (id: number, body: AddOnInput) => patch<MenuAddOn>(`/add-ons/${id}`, body);
export const deleteAddOn = (id: number) => post<{ id: number }>(`/add-ons/${id}/archive`);
/** The add-on's price on one product (one price for every variant). `isActive: false` stops offering it there. */
export const setProductAddOn = (productId: number, addOnId: number, body: { price: Money; isActive: boolean }) =>
  put<MenuProductDetail["addOns"]>(`/products/${productId}/add-ons/${addOnId}`, body);

// ─── Reference data for the variant form ───
export const listUnits = (signal?: AbortSignal) => get<CatalogUnit[]>("/units", undefined, signal);
export const listOptionGroups = (signal?: AbortSignal) => get<CatalogOptionGroup[]>("/option-groups", undefined, signal);
