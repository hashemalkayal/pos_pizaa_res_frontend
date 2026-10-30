import { createContext, useContext } from "react";
import type { Session } from "./session";

/** Why the user was sent to the sign-in page; shown there as a notice. */
export type SignOutReason = "expired" | "invalid" | "userNotFound" | "signedOut";

export interface SessionContextValue {
  session: Session | null;
  /** Why the last session ended (null while signed in or before any session). */
  signOutReason: SignOutReason | null;
  /** Starts a session from a sign-in token; null if the token is unusable. */
  signIn: (accessToken: string) => Session | null;
  /** Ends the session; the route guards then show the sign-in page with the reason. */
  signOut: (reason?: SignOutReason) => void;
}

export const SessionContext = createContext<SessionContextValue | null>(null);

export const useSession = (): SessionContextValue => {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside <SessionProvider>.");
  return value;
};
