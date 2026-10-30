/** A backend money value: decimal string, up to 3 decimals (JOD fils), optionally negative. */
const MONEY_PATTERN = /^-?\d+(\.\d{1,3})?$/;

export const isMoney = (value: string): boolean => MONEY_PATTERN.test(value.trim());

/**
 * Formats a backend money string for display with exactly 3 decimals and thousands grouping
 * ("1234.5" → "1,234.500"), using string arithmetic only — never floating point.
 */
export const formatMoney = (value: string): string => {
  const text = value.trim();
  if (!MONEY_PATTERN.test(text)) throw new RangeError(`Not a money value: "${value}"`);
  const negative = text.startsWith("-");
  const [integerPart, fraction = ""] = text.replace("-", "").split(".");
  const integer = integerPart.replace(/^0+(?=\d)/, "");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const isZero = /^0+$/.test(integer) && /^0*$/.test(fraction);
  return `${negative && !isZero ? "-" : ""}${grouped}.${fraction.padEnd(3, "0")}`;
};

/**
 * Money as an integer number of fils (thousandths of a JOD), for exact arithmetic on backend amounts
 * ("4.5" → 4500). Safe far beyond any order total.
 */
export const toFils = (value: string): number => {
  const text = value.trim();
  if (!MONEY_PATTERN.test(text)) throw new RangeError(`Not a money value: "${value}"`);
  const negative = text.startsWith("-");
  const [integer, fraction = ""] = text.replace("-", "").split(".");
  const fils = Number(integer) * 1000 + Number(fraction.padEnd(3, "0"));
  return negative ? -fils : fils;
};

/** Fils back to a plain money string with 3 decimals (4500 → "4.500"), as the API expects. */
export const fromFils = (fils: number): string => {
  if (!Number.isSafeInteger(fils)) throw new RangeError(`Not a whole number of fils: ${fils}`);
  const absolute = Math.abs(fils);
  const text = `${Math.floor(absolute / 1000)}.${String(absolute % 1000).padStart(3, "0")}`;
  return fils < 0 ? `-${text}` : text;
};

/**
 * A money amount typed by the cashier: non-negative, at most 3 decimals and 7 integer digits
 * (the backend's rule for delivery prices).
 */
export const isMoneyInput = (value: string): boolean => /^\d{1,7}(\.\d{1,3})?$/.test(value.trim());

/** A discount percentage: 0–100 with at most 2 decimals (the backend's rule). */
export const isPercentInput = (value: string): boolean => {
  const text = value.trim();
  return /^\d{1,3}(\.\d{1,2})?$/.test(text) && Number(text) <= 100;
};
