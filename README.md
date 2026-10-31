# Engineers Pizza POS — frontend (V2)

The staff POS for Engineers Pizza: React 18, Vite, TypeScript, Mantine 8, TanStack Query, Axios, React Router, i18next (English / Arabic, RTL).

Branch `v2` is the V2 rebuild. It talks **only** to the backend V2 API, so it goes live together with the backend cutover. `main` keeps the current POS until then.

## Scripts

| Command | What it does |
|---|---|
| `yarn dev:mock` | Dev server with every API call answered by MSW mocks (no backend needed). An orange **Mock data** badge is always shown. |
| `yarn dev` | Dev server against the **local DEV backend V2** (`http://localhost:8080/api`, `.env.dev`). Mocks never run in this mode. |
| `yarn dev:staging` | Dev server against the backend in `.env.staging` |
| `yarn build` | Type-check and production build (`--mode staging`); mocks are never included |
| `yarn typecheck` · `yarn lint` · `yarn test` | Checks; tests run on Vitest + Testing Library + MSW |
| `yarn test:live` | Live contract tests (`*.live.test.ts`): the typed V2 clients against the real local backend, and the MSW mocks compared with it. Needs `LIVE_EMAIL` and `LIVE_PASSWORD` (a local test user). Refuses non-local APIs. |

**Mock sign-in (development fixtures, not real accounts):** `admin@mock.local` / `mock-admin` and `cashier@mock.local` / `mock-cashier`.

## Real local backend

The backend repository runs POS V2 locally on the MySQL database `pos` (`127.0.0.1:3306`) with a fake print agent; see `docs/dev-setup.md` there (`pnpm dev:db:reset`, `pnpm dev:print-agent`, `pnpm dev`). Then run `yarn dev` here and sign in with a DEV account: `admin@pos-v2.local` or `cashier@pos-v2.local`, password `P@ssw0rd` (local DEV only).

Mocks start only in mode `mock` with `VITE_API_MOCKING=enabled` (`src/main.tsx`, `src/api/config.ts`). No other mode can enable them.

**Mocks vs the real API (checked by `yarn test:live`, 2026-10-30):**

- **Identical:**
  - the login success shape and token claims;
  - the 401 and 422 login bodies;
  - the `TOKEN_MISSING` and `INVALID_TOKEN` bodies;
  - the full catalog key structure.
- **Not mocked yet:** quote, orders, customers, reports. Add them with Phase 2+.
- **Fixture coverage gaps** (the shapes match; the data does not cover these cases):
  - single-variant products whose variant has no label (28 in the real menu: sandwiches, drinks, most pasta and salads);
  - products without add-ons (30);
  - no product images (none in the real menu either);
  - only 3 of the 8 categories.
- **Rate limit:** the mock limits failed sign-ins per email only; the backend also limits 20 per IP per 15 minutes.

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
  public-site/  public Landing (V2 brand) and Menu (kept from the previous app) pages, isolated from the POS
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
| Landing (public) | Landing: V2 brand, English / Arabic | done |
| Menu (public) | Kept as it is (redesign deferred) | — |
