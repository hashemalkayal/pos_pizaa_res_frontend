import { Badge, Tooltip } from "@mantine/core";
import { IconFlask } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { isMockMode } from "@/api/config";

/** Always visible while MSW answers the API, so mock data is never mistaken for live data. */
export const MockModeBadge = () => {
  const { t } = useTranslation();
  if (!isMockMode()) return null;
  return (
    <Tooltip label={t("shell.mockModeHint")} multiline w={260} withArrow>
      <Badge color="orange" variant="filled" leftSection={<IconFlask size={14} />} tabIndex={0}>
        {t("shell.mockMode")}
      </Badge>
    </Tooltip>
  );
};
