/**
 * Customer phone numbers, as the backend stores them (backend src/utils/phone.ts): a Jordanian mobile in one canonical
 * form, 07XXXXXXXX (077, 078 or 079). Accepted input: 07…, +9627…, 009627…, 9627…, +96207… and 7… (without the 0), with
 * spaces, hyphens, parentheses, dots, slashes, invisible direction marks or Arabic-Indic digits.
 */

const JORDAN_MOBILE = /^(?:(?:\+|00)?962)?0?(7[789]\d{7})$/;

/** Removes formatting and invisible marks; Arabic-Indic and Persian digits become 0-9. */
export const compactPhone = (raw: string): string =>
  raw
    .normalize("NFKC")
    .replace(/\p{Cf}/gu, "")
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[\s\-()./]/g, "");

/** The canonical 07XXXXXXXX form, or null (not a Jordanian mobile, or a placeholder such as 0790000000). */
export const canonicalJordanMobile = (raw: string): string | null => {
  const match = compactPhone(raw).match(JORDAN_MOBILE);
  if (!match) return null;
  const canonical = `0${match[1]}`;
  return /^07[789](\d)\1{6}$/.test(canonical) ? null : canonical;
};

/** A typed number, complete or partial, as it appears in stored numbers ("+962 79 12" → "07912"). */
export const phoneSearchFragment = (raw: string): string =>
  canonicalJordanMobile(raw) ?? compactPhone(raw).replace(/^(?:\+|00)?962(?=\d)/, "0").replace(/^00(?=7)/, "0");
