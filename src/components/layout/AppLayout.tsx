import { useEffect, useRef } from "react";
import { AppShell, Box, Burger, Group, NavLink, ScrollArea, Text, Title } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { sectionForPath, sectionsForRole } from "@/app/navigation";
import { useSession } from "@/features/auth/sessionContext";
import { BrandLogo } from "./BrandLogo";
import { LanguageSwitch } from "./LanguageSwitch";
import { MockModeBadge } from "./MockModeBadge";
import { UserMenu } from "./UserMenu";
import classes from "./AppLayout.module.css";

const NAVBAR_WIDTH = 248;

/**
 * Staff application shell: a full-height charcoal column (logo + navigation), a light header with the page
 * title and account controls, and the light workspace. On phones the navigation opens below the header.
 */
export const AppLayout = () => {
  const { t } = useTranslation();
  const { session } = useSession();
  const { pathname } = useLocation();
  const [opened, { toggle, close }] = useDisclosure(false);
  const sections = sectionsForRole(session?.user.role);
  const current = sectionForPath(pathname);
  // The cashier screen fills the workspace edge to edge; its columns scroll and carry the page gaps on their own.
  const fullBleed = pathname === "/pos";
  // The workspace is the scroll container (not the window): each section opens at its top.
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [pathname]);

  return (
    <AppShell
      header={{ height: 64 }}
      navbar={{ width: NAVBAR_WIDTH, breakpoint: "sm", collapsed: { mobile: !opened } }}
      classNames={{ header: classes.header, navbar: classes.navbar, main: classes.main }}
    >
      <AppShell.Header>
        <div className={classes.headerInner}>
          <div className={classes.headerBrand} style={{ width: NAVBAR_WIDTH }}>
            <BrandLogo className={classes.headerLogo} />
          </div>
          <Group className={classes.headerMain} justify="space-between" wrap="nowrap" px="md">
            <Group gap="sm" wrap="nowrap">
              <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" aria-label={t("shell.toggleNavigation")} />
              <Title order={1} size="h4" className={classes.headerTitle}>
                {current ? t(current.labelKey) : t("app.product")}
              </Title>
            </Group>
            <Group gap="sm" wrap="nowrap">
              <MockModeBadge />
              <LanguageSwitch />
              <UserMenu />
            </Group>
          </Group>
        </div>
      </AppShell.Header>

      <AppShell.Navbar>
        <Box hiddenFrom="sm" className={classes.navBrand}>
          <BrandLogo className={classes.navLogo} />
        </Box>
        <ScrollArea
          component="nav"
          aria-label={t("nav.label")}
          className={classes.nav}
          type="auto"
          scrollbarSize={8}
          classNames={{ scrollbar: classes.navScrollbar, thumb: classes.navThumb }}
        >
          {sections.map((section) => {
            const active = current?.id === section.id;
            return (
              <NavLink
                key={section.id}
                component={Link}
                to={section.path}
                label={t(section.labelKey)}
                leftSection={<section.icon size={20} stroke={1.7} aria-hidden />}
                active={active}
                aria-current={active ? "page" : undefined}
                onClick={close}
                classNames={{ root: classes.link, label: classes.linkLabel }}
              />
            );
          })}
        </ScrollArea>
        <Text size="xs" className={classes.footer}>
          {t("app.name")} · {t("app.product")}
        </Text>
      </AppShell.Navbar>

      <AppShell.Main ref={mainRef} mod={{ "full-bleed": fullBleed }}>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
};
