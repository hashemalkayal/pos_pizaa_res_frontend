import { errorMessageKey, type ApiError } from "@/api/errors";

/** Backend codes of the order path with a POS-specific explanation (backend: order-pricing, order.service). */
const POS_ERROR_CODES = new Set(["ADDON_NOT_AVAILABLE", "VARIANT_NOT_FOUND", "VARIANT_UNAVAILABLE", "CUSTOMER_NOT_FOUND", "PRICE_MISMATCH"]);

/** i18n key explaining a failed order creation. */
export const orderErrorKey = (error: ApiError) => (error.code && POS_ERROR_CODES.has(error.code) ? `pos.errors.${error.code}` : errorMessageKey(error));

/** PRICE_MISMATCH (D77): the backend's current total for the same order, from `details.pricing.totalAmount`. */
export const mismatchTotal = (error: ApiError): string | null => {
  if (error.code !== "PRICE_MISMATCH") return null;
  const total = (error.details as { pricing?: { totalAmount?: unknown } } | null)?.pricing?.totalAmount;
  return typeof total === "string" ? total : null;
};
