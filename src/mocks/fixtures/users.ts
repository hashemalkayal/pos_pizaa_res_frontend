/**
 * DEVELOPMENT FIXTURE — not real accounts. Used only by the MSW mocks (`yarn dev:mock`) and tests.
 * Roles follow the backend enum (ADMIN, CASHER).
 */
export const MOCK_USERS = [
  { id: 1, email: "admin@mock.local", password: "mock-admin", role: "ADMIN" },
  { id: 2, email: "cashier@mock.local", password: "mock-cashier", role: "CASHER" },
] as const;
