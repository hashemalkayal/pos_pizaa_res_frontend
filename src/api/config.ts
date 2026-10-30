/** Backend base URL including `/api` (VITE_PUBLIC_API_URL), without a trailing slash. */
export const apiBaseUrl = (): string => {
  const url = import.meta.env.VITE_PUBLIC_API_URL;
  if (!url) throw new Error("VITE_PUBLIC_API_URL is not configured.");
  return url.replace(/\/+$/, "");
};

/** True only in the dev server started with `yarn dev:mock`; always false in production builds. */
export const isMockMode = (): boolean => import.meta.env.DEV && import.meta.env.VITE_API_MOCKING === "enabled";
