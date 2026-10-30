import { jwtDecode } from "jwt-decode";

/** Roles as stored by the backend (`User.role`). D30: the frontend uses them for navigation only. */
export type StaffRole = "ADMIN" | "CASHER";

export interface SessionUser {
  id: number;
  /** The backend has no display name; staff are shown by email (D64). */
  email: string;
  role: string;
}

export interface Session {
  accessToken: string;
  /** ISO time of the token's `exp` (15 days after sign-in, D62). */
  expiresAt: string;
  user: SessionUser;
}

export const SESSION_STORAGE_KEY = "ep.v2.session";

interface TokenClaims {
  userId: unknown;
  email: unknown;
  role: unknown;
  exp: unknown;
}

/**
 * Reads the claims the backend signs ({ userId, email, role, iat, exp }). The signature is verified by the
 * server on every request; the client only uses the claims for display, navigation and expiry.
 */
export const sessionFromToken = (accessToken: string): Session | null => {
  let claims: Partial<TokenClaims>;
  try {
    claims = jwtDecode<Partial<TokenClaims>>(accessToken);
  } catch {
    return null;
  }
  const { userId, email, role, exp } = claims;
  if (typeof exp !== "number" || !Number.isInteger(userId) || (userId as number) <= 0) return null;
  if (typeof email !== "string" || typeof role !== "string") return null;
  return { accessToken, expiresAt: new Date(exp * 1000).toISOString(), user: { id: userId as number, email, role } };
};

export const isSessionExpired = (session: Session, now: number = Date.now()) => Date.parse(session.expiresAt) <= now;

// Storage can be unavailable (private mode, blocked site data): fall back to memory for this tab.
let memoryToken: string | null = null;

export const readStoredSession = (): Session | null => {
  let token = memoryToken;
  try {
    token = window.localStorage.getItem(SESSION_STORAGE_KEY) ?? null;
  } catch {
    // Use the in-memory token.
  }
  return token ? sessionFromToken(token) : null;
};

export const storeSession = (accessToken: string) => {
  memoryToken = accessToken;
  try {
    window.localStorage.setItem(SESSION_STORAGE_KEY, accessToken);
  } catch {
    // Kept in memory only.
  }
};

export const clearStoredSession = () => {
  memoryToken = null;
  try {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Nothing stored.
  }
};

/** Token for the Authorization header; null when signed out or expired. */
export const getAccessToken = (): string | null => {
  const session = readStoredSession();
  return session && !isSessionExpired(session) ? session.accessToken : null;
};

export const isAdmin = (user: SessionUser | null | undefined) => user?.role === "ADMIN";
