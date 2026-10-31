import { Tabs } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { AddOnsTab } from "./AddOnsTab";
import { MenuBrowser } from "./MenuBrowser";
import classes from "./Menu.module.css";

const TABS = ["menu", "addons"] as const;
type MenuPageTab = (typeof TABS)[number];

/**
 * Menu management (ADMIN only, D80), in two tabs: Menu (categories → products → options → variants, sizes and prices)
 * and Add-ons. Records open in a side drawer (details, create, edit, delete). The tab is the address (/catalog/:tab).
 * Deleting is always a soft delete; every change refreshes the POS menu.
 */
const MenuPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { tab } = useParams();
  const current: MenuPageTab = TABS.includes(tab as MenuPageTab) ? (tab as MenuPageTab) : "menu";

  return (
    <div className={classes.page}>
      <Tabs value={current} onChange={(value) => value && navigate(`/catalog/${value}`)} className={classes.tabs} keepMounted={false}>
        <Tabs.List>
          {TABS.map((id) => (
            <Tabs.Tab key={id} value={id} fw={600}>
              {t(`menu.tabs.${id}`)}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        <Tabs.Panel value="menu" className={classes.panel}>
          <MenuBrowser />
        </Tabs.Panel>
        <Tabs.Panel value="addons" className={classes.panel}>
          <AddOnsTab />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
};

export default MenuPage;
