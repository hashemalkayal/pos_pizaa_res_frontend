import { keepPreviousData, useQuery, type QueryClient } from "@tanstack/react-query";
import {
  getMenuAddOn,
  getMenuProduct,
  listMenuAddOns,
  listMenuCategories,
  listMenuProducts,
  listOptionGroups,
  listUnits,
} from "@/api/v2/menu";

/** Products and add-ons per page (server-side); categories and a product's variants are short lists. */
export const MENU_PAGE_SIZE = 20;
/** The add-on prices product picker: every product, up to the backend's page limit. */
const ALL_PRODUCTS = 200;

export const useMenuCategories = () => useQuery({ queryKey: ["menu", "categories"], queryFn: ({ signal }) => listMenuCategories(signal) });

/** One page of a category's products (not deleted), optionally searched by name. */
export const useMenuProducts = (categoryId: number, search: string, page: number) =>
  useQuery({
    queryKey: ["menu", "products", categoryId, search, page],
    queryFn: ({ signal }) => listMenuProducts({ categoryId, ...(search ? { q: search } : {}), page, pageSize: MENU_PAGE_SIZE }, signal),
    placeholderData: keepPreviousData,
  });

export const useAllMenuProducts = () =>
  useQuery({ queryKey: ["menu", "products", "all"], queryFn: ({ signal }) => listMenuProducts({ pageSize: ALL_PRODUCTS }, signal) });

export const useMenuProduct = (productId: number | null) =>
  useQuery({ queryKey: ["menu", "product", productId], queryFn: ({ signal }) => getMenuProduct(productId as number, signal), enabled: productId !== null });

export const useMenuAddOns = (search: string, page: number) =>
  useQuery({
    queryKey: ["menu", "add-ons", search, page],
    queryFn: ({ signal }) => listMenuAddOns({ ...(search ? { q: search } : {}), page, pageSize: MENU_PAGE_SIZE }, signal),
    placeholderData: keepPreviousData,
  });

export const useMenuAddOn = (addOnId: number | null) =>
  useQuery({ queryKey: ["menu", "add-on", addOnId], queryFn: ({ signal }) => getMenuAddOn(addOnId as number, signal), enabled: addOnId !== null });

export const useUnits = () => useQuery({ queryKey: ["menu", "units"], queryFn: ({ signal }) => listUnits(signal), staleTime: 5 * 60_000 });
export const useOptionGroups = () => useQuery({ queryKey: ["menu", "option-groups"], queryFn: ({ signal }) => listOptionGroups(signal), staleTime: 5 * 60_000 });

/** After any menu change: every Menu list and detail, and the POS menu (["catalog"]), which prices the cart. */
export const refreshMenu = (queryClient: QueryClient) => {
  void queryClient.invalidateQueries({ queryKey: ["menu"] });
  void queryClient.invalidateQueries({ queryKey: ["catalog"] });
};
