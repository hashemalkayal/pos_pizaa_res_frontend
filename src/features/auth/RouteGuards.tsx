import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { IconLock } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/feedback/EmptyState";
import { isAdmin } from "./session";
import { useSession, type SignOutReason } from "./sessionContext";

/** Navigation state passed to the sign-in page. */
export interface SignInLocationState {
  /** Where to return after signing in. */
  from?: string;
  reason?: SignOutReason;
}

/**
 * Staff-only area. Without a session (never signed in, expired, 401, signed out) the user goes to sign-in
 * with the reason; after signing in again they return to the same page, except after a deliberate sign-out.
 */
export const RequireSession = () => {
  const { session, signOutReason } = useSession();
  const location = useLocation();
  if (!session) {
    const state: SignInLocationState = {
      from: signOutReason === "signedOut" ? undefined : `${location.pathname}${location.search}`,
      reason: signOutReason ?? undefined,
    };
    return <Navigate to="/login" replace state={state} />;
  }
  return <Outlet />;
};

/** The sign-in page is skipped when a session exists; after sign-in this sends the user on. */
export const RedirectWhenSignedIn = () => {
  const { session } = useSession();
  const location = useLocation();
  if (!session) return <Outlet />;
  const from = (location.state as SignInLocationState | null)?.from;
  return <Navigate to={from && from !== "/login" ? from : "/pos"} replace />;
};

/** UX rule only (D30 deferred): the backend does not restrict these sections by role. */
export const AdminOnly = ({ children }: { children: ReactNode }) => {
  const { session } = useSession();
  const { t } = useTranslation();
  if (!isAdmin(session?.user)) {
    return <EmptyState icon={<IconLock size={28} stroke={1.6} />} title={t("adminOnly.title")} description={t("adminOnly.description")} />;
  }
  return <>{children}</>;
};
