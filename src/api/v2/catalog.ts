import { http, unwrap, type ApiEnvelope } from "../http";

/** Money as the backend sends it: a decimal string with 3 decimals, e.g. "4.500" (JOD). */
export type Money = string;

/**
 * GET /api/catalog — the POS menu (backend: product.service getMenu + catalog-serializers).
 * Only active categories; per category, only active, unarchived products that have at least one active,
 * unarchived variant. Categories may be empty (Staff Meal starts with no products, D71).
 */
export interface CatalogCategory {
  id: number;
  nameEn: string;
  nameAr: string;
  imageUrl: string | null;
  sortOrder: number;
  products: CatalogProduct[];
}

export interface CatalogProduct {
  id: number;
  slug: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  imageUrl: string | null;
  usesUnits: boolean;
  optionGroups: CatalogOptionGroup[];
  variants: CatalogVariant[];
  ingredients: { id: number; nameEn: string; nameAr: string }[];
  /** Add-ons offered for this product; one price per product, the same for every variant. */
  addOns: { addOnId: number; nameEn: string; nameAr: string; price: Money }[];
}

export interface CatalogOptionGroup {
  id: number;
  /** e.g. DOUGH, PASTA_TYPE */
  code: string;
  nameEn: string;
  nameAr: string;
  sortOrder: number;
  values: CatalogOptionValue[];
}

export interface CatalogOptionValue {
  id: number;
  optionGroupId: number;
  code: string;
  nameEn: string;
  nameAr: string;
  sortOrder: number;
  isActive: boolean;
}

export interface CatalogUnit {
  id: number;
  /** e.g. M, L */
  code: string;
  nameEn: string;
  nameAr: string;
  sortOrder: number;
  isActive: boolean;
}

/** One sellable choice (e.g. Margherita · Medium · Regular dough); the price belongs to the variant. */
export interface CatalogVariant {
  id: number;
  productId: number;
  sku: string;
  unit: CatalogUnit | null;
  options: { groupId: number; group: string; valueId: number; value: string; nameEn: string; nameAr: string }[];
  /** "Medium · Regular"; null when the variant has no unit and no options (e.g. Water). */
  labelEn: string | null;
  labelAr: string | null;
  price: Money;
  isActive: boolean;
  isDefault: boolean;
  sortOrder: number;
  archived: boolean;
  archivedAt: string | null;
}

export const getCatalog = async (): Promise<CatalogCategory[]> =>
  unwrap(await http.get<ApiEnvelope<CatalogCategory[]>>("/catalog"));
