import { ActionIcon, VisuallyHidden } from "@mantine/core";
import { IconMinus, IconPlus } from "@tabler/icons-react";
import { MAX_QUANTITY } from "../model/cart";
import classes from "../Pos.module.css";

interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  decreaseLabel: string;
  increaseLabel: string;
  /** Accessible name of the value, e.g. "2 × Margherita". */
  valueLabel?: string;
  size?: "sm" | "md";
}

/** − value + within 1–99 (the backend's line quantity range). */
export const QuantityStepper = ({ value, onChange, decreaseLabel, increaseLabel, valueLabel, size = "sm" }: QuantityStepperProps) => {
  const iconSize = size === "md" ? 18 : 15;
  return (
    <span className={classes.stepper}>
      <ActionIcon variant="subtle" color="charcoal" radius="xl" size={size === "md" ? 36 : 30} disabled={value <= 1} onClick={() => onChange(value - 1)} aria-label={decreaseLabel}>
        <IconMinus size={iconSize} />
      </ActionIcon>
      <span className={classes.stepperValue} aria-live="polite">
        <span aria-hidden={valueLabel ? true : undefined}>{value}</span>
        {valueLabel ? <VisuallyHidden>{valueLabel}</VisuallyHidden> : null}
      </span>
      <ActionIcon variant="subtle" color="charcoal" radius="xl" size={size === "md" ? 36 : 30} disabled={value >= MAX_QUANTITY} onClick={() => onChange(value + 1)} aria-label={increaseLabel}>
        <IconPlus size={iconSize} />
      </ActionIcon>
    </span>
  );
};
