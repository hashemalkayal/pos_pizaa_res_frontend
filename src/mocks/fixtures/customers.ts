import type { Customer } from "@/api/v2/customers";

/** DEVELOPMENT FIXTURE — not real people. Initial customers of the MSW mocks (`yarn dev:mock`) and tests. */
export const MOCK_CUSTOMERS: Customer[] = [
  { id: 1, name: "Mock Customer", phone: "0790000001", createdAt: "2026-10-01T09:00:00.000Z" },
  { id: 2, name: "عميل تجريبي", phone: "0780000002", createdAt: "2026-10-02T09:00:00.000Z" },
];
