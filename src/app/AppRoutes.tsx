import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { APP_SECTIONS } from "./navigation";
import { NotFoundPage } from "./pages/NotFoundPage";
import { PlannedSectionPage } from "./pages/PlannedSectionPage";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoginPage } from "@/features/auth/LoginPage";
import { AdminOnly, RedirectWhenSignedIn, RequireSession } from "@/features/auth/RouteGuards";
import { LoadingState } from "@/components/feedback/LoadingState";
import { PosDraftProvider } from "@/features/pos/state/PosDraftProvider";

// Public pages kept from the previous app, isolated from the POS (own chunks, no session, no API calls).
const Landing = lazy(() => import("@/public-site/Landing"));
const PublicMenu = lazy(() => import("@/public-site/Menu"));

// Staff screens with their own chunks.
const PosPage = lazy(() => import("@/features/pos/PosPage"));
const OrdersPage = lazy(() => import("@/features/orders/OrdersPage"));
const lazyPage = (page: ReactNode) => <Suspense fallback={<LoadingState />}>{page}</Suspense>;

export const AppRoutes = () => (
  <Routes>
    <Route path="/landing" element={<Suspense fallback={null}><Landing /></Suspense>} />
    <Route path="/menu" element={<Suspense fallback={null}><PublicMenu /></Suspense>} />

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
            section.id === "pos" ? lazyPage(<PosPage />) : section.id === "orders" ? lazyPage(<OrdersPage />) : <PlannedSectionPage section={section} />;
          // The Orders tab opens an order in its drawer at /orders/:orderId: one route, so the list keeps its state.
          const path = section.id === "orders" ? `${section.path}/:orderId?` : section.path;
          return <Route key={section.id} path={path} element={section.adminOnly ? <AdminOnly>{page}</AdminOnly> : page} />;
        })}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Route>
  </Routes>
);
