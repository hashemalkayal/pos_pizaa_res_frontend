import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@mantine/hooks";
import { toApiError, type ApiError } from "@/api/errors";
import { getCatalog } from "@/api/v2/catalog";
import { searchCustomers } from "@/api/v2/customers";
import { quoteOrder, type OrderQuote, type QuoteRequest } from "@/api/v2/orders";
import { quoteKey } from "../model/orderDraft";

export const useCatalog = () =>
  useQuery({ queryKey: ["catalog"], queryFn: ({ signal }) => getCatalog(signal), staleTime: 5 * 60_000 });

export const QUOTE_DEBOUNCE_MS = 250;

/**
 * The backend price of the current cart:
 *   • current  — the quote of exactly this request (checkout allowed);
 *   • updating — a newer request is waiting or loading; the previous quote is still shown, dimmed;
 *   • loading  — no quote yet;
 *   • error    — this request was refused or failed; checkout stays disabled.
 * Each request has its own query, so a late response never replaces a newer one, and a request that is no
 * longer needed is cancelled.
 */
export type QuoteState =
  | { status: "empty" }
  | { status: "loading" }
  | { status: "updating"; quote: OrderQuote }
  | { status: "current"; quote: OrderQuote; key: string }
  | { status: "error"; error: ApiError; retry: () => void };

export const usePosQuote = (request: QuoteRequest | null): QuoteState => {
  const key = quoteKey(request);
  const [debouncedKey] = useDebouncedValue(key, QUOTE_DEBOUNCE_MS);
  const query = useQuery({
    queryKey: ["orders", "quote", debouncedKey],
    queryFn: ({ signal }) => quoteOrder(JSON.parse(debouncedKey as string) as QuoteRequest, signal),
    enabled: debouncedKey !== null,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    retry: false,
  });

  if (key === null) return { status: "empty" };
  const settled = debouncedKey === key && !query.isPlaceholderData;
  if (settled && query.isError) return { status: "error", error: toApiError(query.error), retry: () => void query.refetch() };
  if (settled && query.isSuccess) return { status: "current", quote: query.data, key };
  return query.data ? { status: "updating", quote: query.data } : { status: "loading" };
};

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
