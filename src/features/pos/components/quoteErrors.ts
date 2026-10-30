import { errorMessageKey, type ApiError } from "@/api/errors";

/** Backend codes of the order path with a POS-specific explanation (backend: order-pricing, order.service). */
const POS_ERROR_CODES = new Set(["ADDON_NOT_AVAILABLE", "VARIANT_NOT_FOUND", "VARIANT_UNAVAILABLE", "CUSTOMER_NOT_FOUND"]);

/** i18n key explaining a failed quote or order creation. */
export const quoteErrorKey = (error: ApiError) => (error.code && POS_ERROR_CODES.has(error.code) ? `pos.errors.${error.code}` : errorMessageKey(error));
