/**
 * Delivery time. The backend stores free text (at most 50 characters) and the print agent prints it as-is on
 * the receipt and kitchen ticket, as the previous POS did ("7:00 PM"). The TimePicker gives "HH:mm" (24 h);
 * it is sent as "h:mm AM/PM" in ASCII, which the printer can print.
 */
const TIME_24H = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/;

export const isTimePickerValue = (value: string) => TIME_24H.test(value);

/** "19:30" → "7:30 PM"; "00:05" → "12:05 AM"; "" → null. Throws on anything else. */
export const formatDeliveryTime = (value: string): string | null => {
  if (!value) return null;
  const match = value.match(TIME_24H);
  if (!match) throw new RangeError(`Not a TimePicker value: "${value}"`);
  const hours = Number(match[1]);
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${match[2]} ${hours < 12 ? "AM" : "PM"}`;
};
