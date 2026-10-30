import { forwardRef } from "react";
import { TextInput, type TextInputProps } from "@mantine/core";

interface DecimalInputProps extends Omit<TextInputProps, "value" | "onChange"> {
  value: string;
  onChange: (value: string) => void;
  /** Digits before and after the decimal point that may be typed (e.g. money 7 / 3, percent 3 / 2). */
  integerDigits: number;
  fractionDigits: number;
}

/**
 * A decimal amount kept as the exact string the cashier types — never converted to a floating-point number.
 * Keystrokes that would not fit the pattern are ignored. Numbers read left-to-right in both languages.
 */
export const DecimalInput = forwardRef<HTMLInputElement, DecimalInputProps>(({ value, onChange, integerDigits, fractionDigits, ...props }, ref) => {
  const pattern = new RegExp(`^\\d{0,${integerDigits}}(\\.\\d{0,${fractionDigits}})?$`);
  return (
    <TextInput
      ref={ref}
      {...props}
      value={value}
      onChange={(event) => {
        const next = event.currentTarget.value.replace(",", ".").replace(/\s/g, "");
        if (pattern.test(next)) onChange(next);
      }}
      inputMode="decimal"
      autoComplete="off"
      dir="ltr"
    />
  );
});
DecimalInput.displayName = "DecimalInput";
