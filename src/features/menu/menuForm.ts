import type { UseFormReturnType } from "@mantine/form";
import { useTranslation } from "react-i18next";
import { errorMessageKey, type ApiError } from "@/api/errors";

/** Form rules and error texts of the Menu tabs. */

/** Backend codes with a Menu-specific explanation (menu.errors.*). */
const MENU_ERRORS = new Set([
  "CATEGORY_HAS_PRODUCTS",
  "CATEGORY_ALREADY_EXISTS",
  "CATEGORY_NOT_FOUND",
  "PRODUCT_ALREADY_EXISTS",
  "PRODUCT_STRUCTURE_LOCKED",
  "VARIANT_ALREADY_EXISTS",
  "ADDON_ALREADY_EXISTS",
  "ADDON_NOT_FOUND",
]);
export const menuErrorKey = (error: ApiError) => (error.code && MENU_ERRORS.has(error.code) ? `menu.errors.${error.code}` : errorMessageKey(error));

// ─── Validation (the backend's limits; values are i18n keys, translated by the fields) ───
const MONEY = /^\d{1,7}(\.\d{1,3})?$/;
export const requiredName = (max: number) => (value: string) =>
  !value.trim() ? "menu.validation.required" : value.trim().length > max ? "menu.validation.tooLong" : null;
export const priceRule = (value: string) => (MONEY.test(value.trim()) ? null : "menu.validation.price");
export const sortOrderRule = (value: number | string) => {
  const number = Number(value);
  return value !== "" && Number.isInteger(number) && number >= 0 && number <= 100_000 ? null : "menu.validation.sortOrder";
};
export const descriptionRule = (value: string) => (value.trim().length > 5000 ? "menu.validation.tooLong" : null);
/** "" → null, as the backend stores an empty description. */
export const optionalText = (value: string) => value.trim() || null;

/** Input props with the error translated (form errors are i18n keys). */
export const useFieldProps = <T extends Record<string, unknown>>(form: UseFormReturnType<T>) => {
  const { t } = useTranslation();
  return (path: keyof T & string) => {
    const props = form.getInputProps(path);
    return { ...props, error: props.error ? t(String(props.error)) : undefined };
  };
};
