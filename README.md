# Engineers Pizza POS — frontend (V2)

The staff POS for Engineers Pizza: React 18, Vite, TypeScript, Mantine 8, TanStack Query, Axios, React Router, i18next (English / Arabic, RTL).

Branch `v2` is the V2 rebuild. It talks **only** to the backend V2 API, so it goes live together with the backend cutover. `main` keeps the current POS until then.

## Scripts

| Command | What it does |
|---|---|
| `yarn dev:mock` | Dev server with every API call answered by MSW mocks (no backend needed). An orange **Mock data** badge is always shown. |
| `yarn dev` / `yarn dev:staging` | Dev server against the backend in `.env.dev` / `.env.staging` |
| `yarn build` | Type-check and production build (`--mode staging`); mocks are never included |
| `yarn typecheck` · `yarn lint` · `yarn test` | Checks; tests run on Vitest + Testing Library + MSW |

**Mock sign-in (development fixtures, not real accounts):** `admin@mock.local` / `mock-admin` and `cashier@mock.local` / `mock-cashier`.

## Rules the code follows

- **The backend V2 contract is the only source of truth.** Every DTO in `src/api/v2` and every mock in `src/mocks` mirrors the backend's routes, serializers and error bodies. Legacy endpoints (`/api/item`, `/api/payment`, `/api/customer`) are never called.
- **Mocks are development-only:** started only by `yarn dev:mock`, and absent from production builds.
- **Money:** backend strings, shown as JOD with exactly 3 decimals (`src/lib/money.ts`); never floating-point arithmetic. Totals come from the server (`/api/orders/quote`).
- **Session:** 15-day JWT. Any 401 clears the session and returns to sign-in with the reason. Reports and Finance are hidden from non-admins as a navigation rule only; the backend does not enforce roles (D30).
- **Logo:** the official `src/assets/logo.png`, unmodified.

## Layout

```
src/
  app/          providers, routes, navigation, query client
  api/          axios client, error model, typed V2 endpoints (src/api/v2)
  features/     feature areas (auth: session, sign-in, route guards)
  components/   shared UI (layout, feedback states, money)
  i18n/         i18next setup and en/ar resources
  theme/        Mantine theme and brand tokens
  mocks/        MSW handlers and labelled fixtures (development/test only)
  public-site/  public Landing and Menu pages (kept from the previous app, isolated)
  test/         test setup and helpers
```

## Rebuild status

The previous screens remain on `main`. Each is rebuilt on V2 data in the phase shown:

| Previous screen | V2 section | Phase |
|---|---|---|
| Login | Sign-in | 1 — done |
| Create Order (cart, comments, discount, payment, customer, delivery, change calculator) | POS | 2 |
| Orders History (today, delete → void, print) | Orders (edit, void, print, EXTERNAL orders) | 3 |
| Customer dropdown | Customers | 3 |
| Categories (item add/edit/delete) | Menu (categories, products, variants, add-ons) | 4 |
| Home dashboard, Reports, Finance | Reports and Finance (V2 reports, CSV export) | 5 |
| Landing, Menu (public) | Kept as they are (redesign deferred) | — |
