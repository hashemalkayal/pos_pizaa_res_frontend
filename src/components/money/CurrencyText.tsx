import { Text, type TextProps } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { formatMoney } from "@/lib/money";

interface CurrencyTextProps extends Omit<TextProps, "children"> {
  /** Backend money string, e.g. "12.500". */
  value: string;
}

/**
 * JOD amount with exactly 3 decimals. The number is isolated left-to-right so it reads correctly inside
 * Arabic text; digits stay Latin in both languages.
 */
export const CurrencyText = ({ value, ...props }: CurrencyTextProps) => {
  const { t } = useTranslation();
  return (
    <Text component="span" {...props}>
      <bdi dir="ltr">{formatMoney(value)}</bdi> {t("currency.jod")}
    </Text>
  );
};
