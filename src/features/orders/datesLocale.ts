import type { DatesProviderSettings } from "@mantine/dates";
import dayjs from "dayjs";
import arabic from "dayjs/locale/ar";

/**
 * Locale of the Mantine date picker in Arabic: Arabic day names, the month names used in Jordan (Levantine:
 * "تشرين الأول" rather than "أكتوبر"), and Latin digits like every other number in the app (dayjs's "ar" locale
 * would turn digits into Arabic-Indic ones through postformat).
 */
export const ARABIC_DATES_LOCALE = "ar-latn";

const LEVANTINE_MONTHS = ["كانون الثاني", "شباط", "آذار", "نيسان", "أيار", "حزيران", "تموز", "آب", "أيلول", "تشرين الأول", "تشرين الثاني", "كانون الأول"];

const withoutDigitConversion = Object.fromEntries(Object.entries(arabic).filter(([key]) => key !== "postformat" && key !== "preparse"));
dayjs.locale({ ...withoutDigitConversion, name: ARABIC_DATES_LOCALE, months: LEVANTINE_MONTHS, monthsShort: LEVANTINE_MONTHS } as ILocale, undefined, true);

/** Orders date picker settings: the language's locale, and Jordan's calendar week — it starts on Sunday and the weekend is Friday and Saturday. */
export const datesSettings = (language: string): DatesProviderSettings => ({
  locale: language === "ar" ? ARABIC_DATES_LOCALE : "en",
  firstDayOfWeek: 0,
  weekendDays: [5, 6],
});
