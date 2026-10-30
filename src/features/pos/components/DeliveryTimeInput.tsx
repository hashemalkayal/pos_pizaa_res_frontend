import { useRef } from "react";
import { TimePicker } from "@mantine/dates";
import { useTranslation } from "react-i18next";

/** True when some of the hour, minute and AM/PM fields are filled but not all (an empty AM/PM field shows "--"). */
const isPartlyFilled = (root: HTMLElement | null) => {
  const fields = [...(root?.querySelectorAll<HTMLInputElement>("input[aria-label]") ?? [])];
  const filled = fields.filter((field) => field.value.replace(/-/g, "").trim() !== "").length;
  return filled > 0 && filled < fields.length;
};

interface DeliveryTimeInputProps {
  /** TimePicker value: "HH:mm" (24 h), or "" when empty or incomplete. */
  value: string;
  /** `incomplete`: a time was started but not finished (e.g. 7:30 without AM/PM). */
  onChange: (time: string, incomplete: boolean) => void;
}

/**
 * 12-hour time with keyboard entry (hours, minutes, then A or P). Mantine's TimePicker reports "" both when it is
 * empty and while it is partly filled, so a half-typed time would be dropped silently. The fields are checked when
 * the value becomes empty and when focus leaves them, and an incomplete time blocks checkout until it is completed
 * or cleared.
 */
export const DeliveryTimeInput = ({ value, onChange }: DeliveryTimeInputProps) => {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  // After Mantine has rendered the fields' new state.
  const reportEmpty = () => window.setTimeout(() => onChange("", isPartlyFilled(rootRef.current)), 0);

  return (
    <div ref={rootRef}>
      <TimePicker
        label={t("pos.delivery.time")}
        description={t("pos.delivery.timeHint")}
        format="12h"
        amPmLabels={{ am: "AM", pm: "PM" }}
        hoursInputLabel={t("pos.delivery.hours")}
        minutesInputLabel={t("pos.delivery.minutes")}
        amPmInputLabel={t("pos.delivery.amPm")}
        withDropdown
        clearable
        minutesStep={5}
        value={value}
        onChange={(time) => (time ? onChange(time, false) : reportEmpty())}
        onBlur={() => {
          if (!value) reportEmpty();
        }}
      />
    </div>
  );
};
