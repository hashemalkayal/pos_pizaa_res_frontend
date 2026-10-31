import dayjs from "dayjs";
import arabic from "dayjs/locale/ar";

/**
 * Locale of the Mantine date picker in Arabic: Arabic month and day names with Latin digits, like every other
 * number in the app (dayjs's "ar" locale would turn digits into Arabic-Indic ones through postformat).
 */
export const ARABIC_DATES_LOCALE = "ar-latn";

const withoutDigitConversion = Object.fromEntries(Object.entries(arabic).filter(([key]) => key !== "postformat" && key !== "preparse"));
dayjs.locale({ ...withoutDigitConversion, name: ARABIC_DATES_LOCALE } as ILocale, undefined, true);

export const datesLocale = (language: string) => (language === "ar" ? ARABIC_DATES_LOCALE : "en");
