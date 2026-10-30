import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import ar from "./locales/ar.json";

export const LANGUAGES = ["en", "ar"] as const;
export type Language = (typeof LANGUAGES)[number];

const STORAGE_KEY = "ep.language";

export const isLanguage = (value: unknown): value is Language => LANGUAGES.includes(value as Language);

export const directionOf = (language: string): "rtl" | "ltr" => (language === "ar" ? "rtl" : "ltr");

/** Per-viewer preference only; storage may be unavailable (private mode), so every access is guarded. */
const readStoredLanguage = (): Language | null => {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return isLanguage(value) ? value : null;
  } catch {
    return null;
  }
};

const storeLanguage = (language: string) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Not persisted; the choice still applies to this session.
  }
};

/** Keeps <html lang dir> in sync so the browser, screen readers and CSS logical properties follow the language. */
export const applyDocumentLanguage = (language: string) => {
  document.documentElement.lang = language;
  document.documentElement.dir = directionOf(language);
};

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ar: { translation: ar } },
  lng: readStoredLanguage() ?? "en",
  fallbackLng: "en",
  supportedLngs: LANGUAGES,
  interpolation: { escapeValue: false },
  returnNull: false,
});

applyDocumentLanguage(i18n.language);
i18n.on("languageChanged", (language) => {
  applyDocumentLanguage(language);
  storeLanguage(language);
});

export default i18n;
