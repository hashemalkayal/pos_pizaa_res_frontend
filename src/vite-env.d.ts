/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend base URL including `/api`, e.g. https://host/api. */
  readonly VITE_PUBLIC_API_URL: string;
  /** "enabled" only in `.env.mock` (dev server): answers API calls with MSW mocks. */
  readonly VITE_API_MOCKING?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
