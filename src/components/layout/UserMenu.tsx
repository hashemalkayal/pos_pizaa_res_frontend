import { Avatar, Badge, Group, Menu, Stack, Text, UnstyledButton } from "@mantine/core";
import { IconChevronDown, IconLogout } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { shownName } from "@/features/auth/session";
import { useSession } from "@/features/auth/sessionContext";
import classes from "./AppLayout.module.css";

const roleKey = (role: string) => (role === "ADMIN" || role === "CASHER" ? `roles.${role}` : "roles.unknown");

export const UserMenu = () => {
  const { t } = useTranslation();
  const { session, signOut } = useSession();
  if (!session) return null;
  const { email, role } = session.user;
  const name = shownName(session.user);

  return (
    <Menu position="bottom-end" width={240} withinPortal>
      <Menu.Target>
        <UnstyledButton className={classes.userButton} aria-label={t("shell.accountMenu")}>
          <Group gap="xs" wrap="nowrap">
            <Avatar size={32} radius="xl" color="charcoal" variant="filled">
              {name.slice(0, 1).toUpperCase()}
            </Avatar>
            <Stack gap={0} visibleFrom="sm" className={classes.userText}>
              <Text size="sm" fw={500} truncate="end">
                {name}
              </Text>
              <Text size="xs" c="dimmed">
                {t(roleKey(role))}
              </Text>
            </Stack>
            <IconChevronDown size={16} aria-hidden />
          </Group>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>{t("shell.signedInAs")}</Menu.Label>
        <Stack gap={4} px="sm" pb="xs">
          <Text size="sm" fw={500} truncate="end">
            {name}
          </Text>
          {name !== email ? (
            <Text size="xs" c="dimmed" truncate="end">
              {email}
            </Text>
          ) : null}
          <Badge variant="light" color="charcoal" w="fit-content">
            {t(roleKey(role))}
          </Badge>
        </Stack>
        <Menu.Divider />
        <Menu.Item leftSection={<IconLogout size={16} />} onClick={() => signOut("signedOut")}>
          {t("shell.signOut")}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
};
