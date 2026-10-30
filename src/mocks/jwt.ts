/**
 * DEVELOPMENT/TEST ONLY. Builds an unsigned token with the claims the backend signs
 * ({ userId, email, role, iat, exp }). The real backend rejects it; only the mocks accept it.
 */
const base64Url = (value: unknown) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value))))
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

export const TOKEN_LIFETIME_SECONDS = 15 * 24 * 60 * 60;

export const buildMockToken = (
  claims: { userId: number; email: string; role: string },
  { issuedAt = Math.floor(Date.now() / 1000), lifetimeSeconds = TOKEN_LIFETIME_SECONDS } = {}
) => {
  const payload = { ...claims, iat: issuedAt, exp: issuedAt + lifetimeSeconds };
  return { token: `${base64Url({ alg: "HS256", typ: "JWT" })}.${base64Url(payload)}.mock-signature`, exp: payload.exp };
};

export const readMockToken = (token: string): { userId: number; email: string; role: string; exp: number } | null => {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(payload), (char) => char.charCodeAt(0))));
  } catch {
    return null;
  }
};
