# Engineers Pizza POS — frontend

The staff POS for Engineers Pizza: React 18, Vite, TypeScript, Mantine 8, TanStack Query, Axios, React Router, i18next
(English / Arabic, RTL). It talks only to the POS API of the backend (`D:\Backend\pos`); it goes live together with the
backend's production cutover (`docs/production-cutover.md` there).

**Package manager: yarn** (`yarn.lock` is the only lockfile; do not add a `pnpm-lock.yaml`).

## Scripts

| Command | What it does |
|---|---|
| `yarn install --frozen-lockfile` | Installs exactly what `yarn.lock` pins |
| `yarn dev:mock` | Dev server with every API call answered by MSW mocks (no backend needed). An orange **Mock data** badge is always shown. |
| `yarn dev` | Dev server against the **local DEV backend** (`http://localhost:8080/api`, `.env.dev`). Mocks never run in this mode. |
| `yarn dev:staging` | Dev server against the backend in `.env.staging` |
| `yarn build` | Type-check and production build (`--mode staging`); mocks are never included |
| `yarn typecheck` · `yarn lint` · `yarn test` | Checks; tests run on Vitest + Testing Library + MSW |
| `yarn test:live` | Live contract tests (`*.live.test.ts`): the typed API clients against the real local backend, and the MSW mocks compared with it. Needs `LIVE_EMAIL` and `LIVE_PASSWORD` (a local test user). Refuses non-local APIs. |

**Mock sign-in (development fixtures, not real accounts):** `admin@mock.local` / `mock-admin` and `cashier@mock.local` / `mock-cashier`.

## Real local backend

The backend runs locally on the MySQL database `pos` (`127.0.0.1:3306`) with a fake print agent; see `docs/dev-setup.md`
there (`pnpm dev:db:reset`, `pnpm dev:print-agent`, `pnpm dev`). Then run `yarn dev` here and sign in with a DEV account:
`admin@pos-v2.local` or `cashier@pos-v2.local`, password `P@ssw0rd` (local DEV only).

Mocks start only in mode `mock` with `VITE_API_MOCKING=enabled` (`src/main.tsx`, `src/api/config.ts`). No other mode can
enable them.

## Rules the code follows

- **The backend contract is the only source of truth.** Every DTO in `src/api` and every mock in `src/mocks` mirrors the
  backend's routes, serializers and error bodies. The previous POS's routes (`/api/item`, `/api/payment`,
  `/api/customer`) no longer exist and are never called.
- **Mocks are development-only:** started only by `yarn dev:mock`, and absent from production builds.
- **Money:** backend strings, shown as JOD with exactly 3 decimals (`src/lib/money.ts`); never floating-point arithmetic.
  Totals come from the server (`/api/orders/quote`).
- **Customers:** a name and a Jordanian mobile number; the number identifies the customer and is stored as `07XXXXXXXX`
  (`src/lib/phone.ts` mirrors the backend rule). A known number selects the existing customer.
- **Session:** 15-day JWT, stored under `ep.session`. The account menu shows the employee's display name (token claim),
  or the email. Any 401 clears the session and returns to sign-in with the reason. Menu, Sales Reports and Finance are
  shown to admins only as a navigation rule; the backend enforces its own permissions.
- **Logo:** the official `src/assets/logo.png`, unmodified.

## Layout

```
src/
  app/          providers, routes, navigation, query client
  api/          axios client, error model, typed API endpoints
  features/     POS, Orders, Menu, Sales Reports, Finance, auth
  components/   shared UI (layout, feedback states, money)
  i18n/         i18next setup and en/ar resources
  lib/          money and phone helpers
  theme/        Mantine theme and brand tokens
  mocks/        MSW handlers and labelled fixtures (development/test only)
  public-site/  public Landing (/landing) and Menu (/menu) pages, isolated from the POS
  test/         test setup and helpers
```
