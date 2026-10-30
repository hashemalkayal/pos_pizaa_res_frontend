import { useCallback } from "react";
import { useTranslation } from "react-i18next";

/** Picks the backend's Arabic or English text for the current language (falls back to the other one). */
export const useLocalized = () => {
  const { i18n } = useTranslation();
  const arabic = i18n.language === "ar";
  const pick = useCallback((en: string | null, ar: string | null) => (arabic ? ar || en : en || ar) ?? "", [arabic]);
  const name = useCallback((item: { nameEn: string; nameAr: string }) => pick(item.nameEn, item.nameAr), [pick]);
  return { pick, name, arabic };
};
