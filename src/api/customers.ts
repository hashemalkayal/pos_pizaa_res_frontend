import { http, unwrap, type ApiEnvelope } from "./http";
import type { Page } from "./orders";

/**
 * Customers (backend: src/services/customer.service.ts, D79 revised). Optional on an order. Name and phone are both
 * required; a duplicate is the same name and phone (the same phone with another name is another customer).
 */
export interface Customer {
  id: number;
  name: string;
  phone: string;
  createdAt: string;
  /** Present in list results only. */
  orderCount?: number;
}

/** GET /api/customers?q= — name or phone contains `q`, newest first. */
export const searchCustomers = async (
  q: string,
  signal?: AbortSignal,
): Promise<Page<Customer>> =>
  unwrap(
    await http.get<ApiEnvelope<Page<Customer>>>("/customers", {
      params: { q, pageSize: 8 },
      signal,
    }),
  );

export const getCustomer = async (
  id: number,
  signal?: AbortSignal,
): Promise<Customer> =>
  unwrap(await http.get<ApiEnvelope<Customer>>(`/customers/${id}`, { signal }));

/**
 * POST /api/customers (201). The same name and phone as an existing customer → 409 CUSTOMER_ALREADY_EXISTS with
 * `details.existingCustomerId`.
 */
export const createCustomer = async (body: {
  name: string;
  phone: string;
}): Promise<Customer> =>
  unwrap(await http.post<ApiEnvelope<Customer>>("/customers", body));
