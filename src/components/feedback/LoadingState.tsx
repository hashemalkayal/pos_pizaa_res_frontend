import { Loader, Stack, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import classes from "./Feedback.module.css";

export const LoadingState = ({ label }: { label?: string }) => {
  const { t } = useTranslation();
  const text = label ?? t("common.loading");
  return (
    <Stack align="center" gap="xs" className={classes.loading} role="status" aria-live="polite">
      <Loader color="charcoal" size="md" aria-hidden />
      <Text size="sm" c="dimmed">
        {text}
      </Text>
    </Stack>
  );
};
