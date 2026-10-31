import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@mantine/hooks";
import { getCatalog } from "@/api/catalog";
import { searchCustomers } from "@/api/customers";

/** The catalog: every price the POS shows is computed from it (model/pricing.ts). */
export const useCatalog = () =>
  useQuery({ queryKey: ["catalog"], queryFn: ({ signal }) => getCatalog(signal), staleTime: 5 * 60_000 });

export const CUSTOMER_SEARCH_MIN_LENGTH = 2;

/** Debounced, cancellable customer search (name or phone). */
export const useCustomerSearch = (term: string) => {
  const [debounced] = useDebouncedValue(term.trim(), 300);
  const enabled = debounced.length >= CUSTOMER_SEARCH_MIN_LENGTH;
  const query = useQuery({
    queryKey: ["customers", "search", debounced],
    queryFn: ({ signal }) => searchCustomers(debounced, signal),
    enabled,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
  return { ...query, enabled, pending: term.trim() !== debounced || query.isFetching };
};
