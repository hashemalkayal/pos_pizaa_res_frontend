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
