import type { ReactNode } from "react";
import { Group, Stack, Text, Title } from "@mantine/core";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export const PageHeader = ({ title, description, actions }: PageHeaderProps) => (
  <Group justify="space-between" align="flex-end" mb="lg" gap="md" wrap="wrap">
    <Stack gap={4}>
      <Title order={2}>{title}</Title>
      {description ? <Text c="dimmed">{description}</Text> : null}
    </Stack>
    {actions ? <Group gap="sm">{actions}</Group> : null}
  </Group>
);
