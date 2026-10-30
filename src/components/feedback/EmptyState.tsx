import type { ReactNode } from "react";
import { Stack, Text, ThemeIcon, Title } from "@mantine/core";
import classes from "./Feedback.module.css";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  /** Optional actions or extra content under the description. */
  children?: ReactNode;
}

export const EmptyState = ({ icon, title, description, children }: EmptyStateProps) => (
  <Stack align="center" gap="sm" className={classes.state}>
    <ThemeIcon size={56} radius="xl" variant="light" color="charcoal" aria-hidden>
      {icon}
    </ThemeIcon>
    <Title order={2} size="h3" ta="center">
      {title}
    </Title>
    {description ? (
      <Text c="dimmed" ta="center" maw={520}>
        {description}
      </Text>
    ) : null}
    {children}
  </Stack>
);
