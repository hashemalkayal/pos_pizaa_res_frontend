import { Button, Text } from "@mantine/core";
import { IconAlertTriangle, IconRefresh } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { errorMessageKey, toApiError } from "@/api/errors";
import { EmptyState } from "./EmptyState";

interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
}

/** Full-area error for a failed load, with the request reference and a retry. */
export const ErrorState = ({ error, onRetry }: ErrorStateProps) => {
  const { t } = useTranslation();
  const apiError = toApiError(error);

  return (
    <EmptyState icon={<IconAlertTriangle size={28} stroke={1.6} />} title={t("errors.title")} description={t(errorMessageKey(apiError))}>
      {apiError.requestId ? (
        <Text size="xs" c="dimmed">
          {t("errors.reference", { id: apiError.requestId })}
        </Text>
      ) : null}
      {onRetry ? (
        <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={onRetry}>
          {t("errors.retry")}
        </Button>
      ) : null}
    </EmptyState>
  );
};
