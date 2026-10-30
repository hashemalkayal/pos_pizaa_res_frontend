import { useEffect, type ReactNode } from "react";
import { DirectionProvider, MantineProvider, useDirection } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { directionOf } from "@/i18n";
import { cssVariablesResolver, theme } from "@/theme/theme";

/** Mantine's direction follows the selected language (Arabic → rtl). */
const DirectionSync = () => {
  const { i18n } = useTranslation();
  const { setDirection } = useDirection();
  const direction = directionOf(i18n.language);
  useEffect(() => setDirection(direction), [direction, setDirection]);
  return null;
};

interface AppProvidersProps {
  queryClient: QueryClient;
  children: ReactNode;
  /** "test" disables transitions and portals for deterministic tests. */
  env?: "default" | "test";
}

export const AppProviders = ({ queryClient, children, env = "default" }: AppProvidersProps) => {
  const { i18n } = useTranslation();
  return (
    <DirectionProvider initialDirection={directionOf(i18n.language)} detectDirection={false}>
      <MantineProvider theme={theme} cssVariablesResolver={cssVariablesResolver} forceColorScheme="light" env={env}>
        <DirectionSync />
        <ModalsProvider>
          <Notifications position="top-center" />
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </ModalsProvider>
      </MantineProvider>
    </DirectionProvider>
  );
};
