import { Badge } from "@mantine/core";
import { IconTools } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type { AppSection } from "@/app/navigation";
import { EmptyState } from "@/components/feedback/EmptyState";

/** Honest placeholder for a section whose V2 screen is scheduled for a later phase (no fake data). */
export const PlannedSectionPage = ({ section }: { section: AppSection }) => {
  const { t } = useTranslation();
  const name = t(section.labelKey);
  return (
    <EmptyState
      icon={<section.icon size={28} stroke={1.6} />}
      title={t("planned.title", { section: name })}
      description={t("planned.description", { phase: section.plannedPhase })}
    >
      <Badge variant="light" color="charcoal" leftSection={<IconTools size={12} />}>
        {t("planned.badge", { phase: section.plannedPhase })}
      </Badge>
    </EmptyState>
  );
};
