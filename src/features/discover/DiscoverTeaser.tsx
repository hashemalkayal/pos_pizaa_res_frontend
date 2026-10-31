import type { ReactNode } from "react";
import { Anchor, Badge, Text, ThemeIcon } from "@mantine/core";
import { IconArrowRight } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import classes from "./DiscoverTeaser.module.css";

/**
 * A quiet note about PLANNED modules next to an existing screen (Finance, Menu). Informative only: its one link opens
 * Discover More; nothing here pretends to work.
 */
export const DiscoverTeaser = ({ icon, title, body }: { icon: ReactNode; title: string; body: string }) => {
  const { t } = useTranslation();
  return (
    <aside className={classes.teaser} aria-label={title}>
      <ThemeIcon variant="light" color="charcoal" size={40} radius="md" aria-hidden>
        {icon}
      </ThemeIcon>
      <div className={classes.text}>
        <div className={classes.heading}>
          <Text component="span" fw={800} size="sm" c="charcoal.9">
            {title}
          </Text>
          <Badge size="sm" variant="light" color="charcoal" radius="sm" tt="none">
            {t("discover.planned")}
          </Badge>
        </div>
        <Text size="sm" className={classes.body}>
          {body}
        </Text>
      </div>
      <Anchor component={Link} to="/discover" className={classes.link} fw={700} size="sm" underline="hover">
        {t("discover.teaserLink")}
        <IconArrowRight size={16} aria-hidden className={classes.arrow} />
      </Anchor>
    </aside>
  );
};
