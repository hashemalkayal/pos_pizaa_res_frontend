import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { setUnauthorizedHandler } from "@/api/http";
import type { ApiError } from "@/api/errors";
import { SessionContext, type SignOutReason } from "./sessionContext";
import {
  SESSION_STORAGE_KEY,
  clearStoredSession,
  isSessionExpired,
  readStoredSession,
  sessionFromToken,
  storeSession,
  type Session,
} from "./session";

/** Backend 401 codes (D66) → sign-in notice. */
const reasonForCode = (code: string | null): SignOutReason => {
  if (code === "TOKEN_EXPIRED") return "expired";
  if (code === "USER_NOT_FOUND") return "userNotFound";
  return "invalid";
};

// Browsers fire timeouts longer than ~24.8 days immediately; such sessions rely on the 401 instead.
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

interface SessionState {
  session: Session | null;
  signOutReason: SignOutReason | null;
}

const initialState = (): SessionState => {
  const stored = readStoredSession();
  if (stored && isSessionExpired(stored)) {
    clearStoredSession();
    return { session: null, signOutReason: "expired" };
  }
  return { session: stored, signOutReason: null };
};

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const [state, setState] = useState(initialState);

  const signOut = useCallback(
    (reason: SignOutReason = "signedOut") => {
      clearStoredSession();
      queryClient.clear();
      setState({ session: null, signOutReason: reason });
    },
    [queryClient]
  );

  const signIn = useCallback((accessToken: string) => {
    const session = sessionFromToken(accessToken);
    if (!session || isSessionExpired(session)) return null;
    storeSession(accessToken);
    setState({ session, signOutReason: null });
    return session;
  }, []);

  // Any 401 from the API ends the session (except the sign-in request itself).
  useEffect(() => setUnauthorizedHandler((error: ApiError) => signOut(reasonForCode(error.code))), [signOut]);

  // Sign out exactly when the token expires.
  const { session } = state;
  useEffect(() => {
    if (!session) return;
    const remaining = Date.parse(session.expiresAt) - Date.now();
    if (remaining > MAX_TIMEOUT_MS) return;
    const timer = window.setTimeout(() => signOut("expired"), Math.max(0, remaining));
    return () => window.clearTimeout(timer);
  }, [session, signOut]);

  // Signing out in another tab signs out this one too.
  useEffect(() => {
    if (!session) return;
    const onStorage = (event: StorageEvent) => {
      if (event.key === SESSION_STORAGE_KEY && event.newValue === null) signOut("signedOut");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [session, signOut]);

  const value = useMemo(
    () => ({ session, signOutReason: state.signOutReason, signIn, signOut }),
    [session, state.signOutReason, signIn, signOut]
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};
