import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { APP_SECTIONS } from "./navigation";
import { NotFoundPage } from "./pages/NotFoundPage";
import { PlannedSectionPage } from "./pages/PlannedSectionPage";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoginPage } from "@/features/auth/LoginPage";
import { AdminOnly, RedirectWhenSignedIn, RequireSession } from "@/features/auth/RouteGuards";

// Public pages kept from the previous app, isolated from the POS (own chunks, no session, no API calls).
const Landing = lazy(() => import("@/public-site/Landing"));
const PublicMenu = lazy(() => import("@/public-site/Menu"));

export const AppRoutes = () => (
  <Routes>
    <Route path="/landing" element={<Suspense fallback={null}><Landing /></Suspense>} />
    <Route path="/menu" element={<Suspense fallback={null}><PublicMenu /></Suspense>} />

    <Route element={<RedirectWhenSignedIn />}>
      <Route path="/login" element={<LoginPage />} />
    </Route>

    <Route element={<RequireSession />}>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/pos" replace />} />
        {APP_SECTIONS.map((section) => {
          const page = <PlannedSectionPage section={section} />;
          return <Route key={section.id} path={section.path} element={section.adminOnly ? <AdminOnly>{page}</AdminOnly> : page} />;
        })}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Route>
  </Routes>
);
