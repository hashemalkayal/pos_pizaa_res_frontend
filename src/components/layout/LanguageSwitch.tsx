import { SegmentedControl } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { isLanguage } from "@/i18n";

/** English / Arabic. The direction (ltr/rtl) follows the language. */
export const LanguageSwitch = ({ inverted = false }: { inverted?: boolean }) => {
  const { t, i18n } = useTranslation();
  return (
    <SegmentedControl
      size="xs"
      radius="xl"
      aria-label={t("shell.language")}
      value={i18n.resolvedLanguage ?? i18n.language}
      onChange={(value) => {
        if (isLanguage(value)) void i18n.changeLanguage(value);
      }}
      data={[
        { value: "en", label: <span aria-label={t("language.en")}>{t("language.enShort")}</span> },
        { value: "ar", label: <span aria-label={t("language.ar")}>{t("language.arShort")}</span> },
      ]}
      color={inverted ? "brand" : "charcoal"}
    />
  );
};
