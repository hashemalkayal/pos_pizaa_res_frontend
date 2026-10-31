import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getOrder, listOrders, type OrderStatus, type ServiceType } from "@/api/v2/orders";

/** Orders per page of the Orders tab (server-side pagination). */
export const ORDERS_PAGE_SIZE = 10;

/** Search and filters of the Orders tab; null / "" = not applied. */
export interface OrderFilters {
  /** Digits only: the order number (exact). */
  orderNumber: string;
  status: OrderStatus | null;
  /** YYYY-MM-DD (business date) */
  businessDate: string | null;
  service: ServiceType | null;
}

export const NO_FILTERS: OrderFilters = { orderNumber: "", status: null, businessDate: null, service: null };

/** One page of orders, newest first; the previous page stays shown while the next one loads. */
export const useOrdersPage = (filters: OrderFilters, page: number) =>
  useQuery({
    queryKey: ["orders", "list", filters, page],
    queryFn: ({ signal }) =>
      listOrders(
        {
          ...(filters.orderNumber ? { orderNumber: Number(filters.orderNumber) } : {}),
          ...(filters.status ? { status: filters.status } : {}),
          ...(filters.businessDate ? { businessDate: filters.businessDate } : {}),
          ...(filters.service ? { service: filters.service } : {}),
          page,
          pageSize: ORDERS_PAGE_SIZE,
        },
        signal
      ),
    placeholderData: keepPreviousData,
  });

/** One order with its lines (same key as the POS uses after checkout). */
export const useOrder = (orderId: number | null) =>
  useQuery({
    queryKey: ["orders", orderId],
    queryFn: ({ signal }) => getOrder(orderId as number, signal),
    enabled: orderId !== null,
  });

/** Date and time of an order in the restaurant's time zone, with Latin digits in both languages. */
export const orderDateTime = (iso: string, language: string) =>
  new Intl.DateTimeFormat(language === "ar" ? "ar-JO-u-nu-latn" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Amman" }).format(new Date(iso));
