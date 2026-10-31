import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { APP_SECTIONS, type AppSection } from "./navigation";
import { NotFoundPage } from "./pages/NotFoundPage";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoginPage } from "@/features/auth/LoginPage";
import {
  AdminOnly,
  RedirectWhenSignedIn,
  RequireSession,
} from "@/features/auth/RouteGuards";
import { LoadingState } from "@/components/feedback/LoadingState";
import { PosDraftProvider } from "@/features/pos/state/PosDraftProvider";

// Public pages kept from the previous app, isolated from the POS (own chunks, no session, no API calls).
const Landing = lazy(() => import("@/public-site/Landing"));
const PublicMenu = lazy(() => import("@/public-site/Menu"));

// Staff screens with their own chunks.
const PosPage = lazy(() => import("@/features/pos/PosPage"));
const OrdersPage = lazy(() => import("@/features/orders/OrdersPage"));
const MenuPage = lazy(() => import("@/features/menu/MenuPage"));
const FinancePage = lazy(() => import("@/features/finance/FinancePage"));
const SalesReportsPage = lazy(() => import("@/features/reports/SalesReportsPage"));
const DiscoverPage = lazy(() => import("@/features/discover/DiscoverPage"));

/**
 * The Orders tab opens an order in its drawer at /orders/:orderId, and Menu keeps its tab at /catalog/:tab: one route
 * each, so the page keeps its state.
 */
const ROUTE_PARAMS: Partial<Record<AppSection["id"], string>> = {
  orders: ":orderId?",
  menu: ":tab?",
};

const lazyPage = (page: ReactNode) => (
  <Suspense fallback={<LoadingState />}>{page}</Suspense>
);

export const AppRoutes = () => (
  <Routes>
    <Route
      path="/landing"
      element={
        <Suspense fallback={null}>
          <Landing />
        </Suspense>
      }
    />
    <Route
      path="/menu"
      element={
        <Suspense fallback={null}>
          <PublicMenu />
        </Suspense>
      }
    />

    <Route element={<RedirectWhenSignedIn />}>
      <Route path="/login" element={<LoginPage />} />
    </Route>

    <Route element={<RequireSession />}>
      <Route
        element={
          <PosDraftProvider>
            <AppLayout />
          </PosDraftProvider>
        }
      >
        <Route index element={<Navigate to="/pos" replace />} />
        {APP_SECTIONS.map((section) => {
          const page =
            section.id === "pos" ? (
              lazyPage(<PosPage />)
            ) : section.id === "orders" ? (
              lazyPage(<OrdersPage />)
            ) : section.id === "menu" ? (
              lazyPage(<MenuPage />)
            ) : section.id === "finance" ? (
              lazyPage(<FinancePage />)
            ) : section.id === "discover" ? (
              lazyPage(<DiscoverPage />)
            ) : (
              lazyPage(<SalesReportsPage />)
            );
          const param = ROUTE_PARAMS[section.id];
          const path = param ? `${section.path}/${param}` : section.path;
          return (
            <Route
              key={section.id}
              path={path}
              element={section.adminOnly ? <AdminOnly>{page}</AdminOnly> : page}
            />
          );
        })}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Route>
  </Routes>
);
