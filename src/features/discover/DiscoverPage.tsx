import { useState } from "react";
import { Badge, Button, Chip, CloseButton, Group, Text, TextInput, ThemeIcon, Title } from "@mantine/core";
import { IconCompass, IconInfoCircle, IconMessageCircle, IconSearch, IconSparkles } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/feedback/EmptyState";
import { CAPABILITIES, CATEGORIES, FEATURED, categoryOf, type Capability, type DiscoverCategoryId } from "./catalog";
import { PreviewMock } from "./PreviewMock";
import classes from "./Discover.module.css";

type Filter = "all" | DiscoverCategoryId;

/** Every capability on this page is planned: the label is on every card, never "available". */
export const PlannedBadge = () => {
  const { t } = useTranslation();
  return (
    <Badge variant="light" color="charcoal" radius="sm" tt="none" fw={700} leftSection={<span className={classes.badgeDot} />}>
      {t("discover.planned")}
    </Badge>
  );
};

const FeaturedCard = ({ capability }: { capability: Capability }) => {
  const { t } = useTranslation();
  const category = categoryOf(capability.category);
  const titleId = `discover-featured-${capability.id}`;
  return (
    <article className={classes.featured} aria-labelledby={titleId}>
      <figure className={classes.figure}>
        <PreviewMock variant={capability.mock} color={category.color} size="lg" />
        <figcaption className={classes.illustrative}>{t("discover.illustrative")}</figcaption>
      </figure>
      <div className={classes.featuredBody}>
        <Group justify="space-between" gap="xs" wrap="nowrap">
          <span className={classes.categoryLabel}>
            <span className={classes.categoryDot} style={{ backgroundColor: `var(--mantine-color-${category.color}-6)` }} aria-hidden />
            {t(`discover.categories.${category.id}.title`)}
          </span>
          <PlannedBadge />
        </Group>
        <Group gap="sm" wrap="nowrap">
          <ThemeIcon variant="light" color={category.color} size={38} radius="md" aria-hidden>
            <capability.icon size={21} stroke={1.7} />
          </ThemeIcon>
          <Title order={3} id={titleId} className={classes.featuredTitle}>
            {t(`discover.items.${capability.id}.title`)}
          </Title>
        </Group>
        <Text className={classes.description}>{t(`discover.items.${capability.id}.description`)}</Text>
        <ul className={classes.highlights}>
          {[1, 2, 3].map((n) => (
            <li key={n}>{t(`discover.items.${capability.id}.highlight${n}`)}</li>
          ))}
        </ul>
      </div>
    </article>
  );
};

const CapabilityCard = ({ capability }: { capability: Capability }) => {
  const { t } = useTranslation();
  const category = categoryOf(capability.category);
  const titleId = `discover-item-${capability.id}`;
  return (
    <article className={classes.compact} aria-labelledby={titleId}>
      <figure className={classes.figure}>
        <PreviewMock variant={capability.mock} color={category.color} size="sm" />
        <figcaption className={classes.illustrative} data-size="sm">
          {t("discover.illustration")}
        </figcaption>
      </figure>
      <div className={classes.compactBody}>
        <Group gap={10} wrap="nowrap">
          <ThemeIcon variant="light" color={category.color} size={32} radius="md" aria-hidden>
            <capability.icon size={18} stroke={1.7} />
          </ThemeIcon>
          <Title order={4} id={titleId} className={classes.compactTitle}>
            {t(`discover.items.${capability.id}.title`)}
          </Title>
        </Group>
        <Text className={classes.description} data-size="sm">
          {t(`discover.items.${capability.id}.description`)}
        </Text>
        <div className={classes.compactFooter}>
          <PlannedBadge />
        </div>
      </div>
    </article>
  );
};

/** Lowercase text without Arabic diacritics or tatweel, so "لاء" finds "الولاء" and "Loyalty" finds "loyalty". */
const searchable = (text: string) =>
  text
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ًͯ-ٰٟـ]/g, "");

/**
 * Discover More (ADMIN only; navigation rule, like Menu, Sales Reports and Finance): a preview of PLANNED modules that
 * are not part of the POS. No API call, no data, no fake controls: search and the area filter only narrow this page.
 */
const DiscoverPage = () => {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const term = searchable(search.trim());

  const matches = (capability: Capability) => {
    if (filter !== "all" && capability.category !== filter) return false;
    if (!term) return true;
    const texts = [
      t(`discover.items.${capability.id}.title`),
      t(`discover.items.${capability.id}.description`),
      t(`discover.categories.${capability.category}.title`),
      // The other language's title too, so an English word finds a card while the page is in Arabic.
      t(`discover.items.${capability.id}.title`, { lng: "en" }),
      t(`discover.items.${capability.id}.title`, { lng: "ar" }),
    ];
    return texts.some((text) => searchable(text).includes(term));
  };
  const shown = CAPABILITIES.filter(matches);
  const sections = CATEGORIES.map((category) => ({ category, items: shown.filter((capability) => capability.category === category.id) })).filter(
    (section) => section.items.length > 0
  );
  const browsing = filter === "all" && !term;
  const reset = () => {
    setSearch("");
    setFilter("all");
  };

  return (
    <div className={classes.page}>
      <section className={classes.hero} aria-labelledby="discover-hero-title">
        <div className={classes.heroText}>
          <span className={classes.eyebrow}>
            <IconSparkles size={15} aria-hidden />
            {t("discover.eyebrow")}
          </span>
          <Title order={2} id="discover-hero-title" className={classes.heroTitle}>
            {t("discover.title")}
          </Title>
          <Text className={classes.heroLead}>{t("discover.lead")}</Text>
          <dl className={classes.heroStats}>
            <div>
              <dt>{t("discover.statCapabilities", { count: CAPABILITIES.length })}</dt>
              <dd>{CAPABILITIES.length}</dd>
            </div>
            <div>
              <dt>{t("discover.statAreas", { count: CATEGORIES.length })}</dt>
              <dd>{CATEGORIES.length}</dd>
            </div>
          </dl>
        </div>
        <div className={classes.heroArt} aria-hidden>
          <div className={classes.heroCard} data-slot="back">
            <PreviewMock variant="kds" color="teal" size="sm" />
          </div>
          <div className={classes.heroCard} data-slot="middle">
            <PreviewMock variant="map" color="cyan" size="sm" />
          </div>
          <div className={classes.heroCard} data-slot="front">
            <PreviewMock variant="pnl" color="indigo" size="sm" />
          </div>
        </div>
        <p className={classes.notice} role="note">
          <IconInfoCircle size={18} aria-hidden className={classes.noticeIcon} />
          <span>{t("discover.disclaimer")}</span>
        </p>
      </section>

      {browsing ? (
        <section className={classes.section} aria-labelledby="discover-featured-title">
          <header className={classes.sectionHead}>
            <Title order={2} id="discover-featured-title" className={classes.sectionTitle}>
              {t("discover.featuredTitle")}
            </Title>
            <Text className={classes.sectionHint}>{t("discover.featuredHint")}</Text>
          </header>
          <div className={classes.featuredGrid}>
            {FEATURED.map((id) => CAPABILITIES.find((capability) => capability.id === id)!).map((capability) => (
              <FeaturedCard key={capability.id} capability={capability} />
            ))}
          </div>
        </section>
      ) : null}

      <section className={classes.section} aria-labelledby="discover-browse-title">
        <header className={classes.sectionHead}>
          <Title order={2} id="discover-browse-title" className={classes.sectionTitle}>
            {t("discover.browseTitle")}
          </Title>
          <Text className={classes.sectionHint}>{t("discover.browseHint")}</Text>
        </header>

        <div className={classes.controls}>
          <TextInput
            className={classes.search}
            aria-label={t("discover.searchLabel")}
            placeholder={t("discover.searchPlaceholder")}
            leftSection={<IconSearch size={18} aria-hidden />}
            rightSection={search ? <CloseButton aria-label={t("discover.clearSearch")} onClick={() => setSearch("")} /> : null}
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            size="md"
          />
          <Chip.Group multiple={false} value={filter} onChange={(value) => setFilter(value as Filter)}>
            <div className={classes.chips} role="radiogroup" aria-label={t("discover.filterLabel")}>
              <Chip value="all" size="md" radius="md" color="brand" autoContrast>
                {t("discover.allAreas")}
              </Chip>
              {CATEGORIES.map((category) => (
                <Chip key={category.id} value={category.id} size="md" radius="md" color="brand" autoContrast>
                  {t(`discover.categories.${category.id}.title`)}
                </Chip>
              ))}
            </div>
          </Chip.Group>
        </div>

        <Text className={classes.count} aria-live="polite">
          {t("discover.showing", { shown: shown.length, total: CAPABILITIES.length })}
        </Text>

        {sections.length ? (
          sections.map(({ category, items }) => (
            <section key={category.id} className={classes.category} aria-labelledby={`discover-category-${category.id}`}>
              <div className={classes.categoryHead}>
                <ThemeIcon variant="light" color={category.color} size={42} radius="md" aria-hidden>
                  <category.icon size={23} stroke={1.7} />
                </ThemeIcon>
                <div>
                  <Title order={3} id={`discover-category-${category.id}`} className={classes.categoryTitle}>
                    {t(`discover.categories.${category.id}.title`)}
                  </Title>
                  <Text className={classes.categoryHint}>{t(`discover.categories.${category.id}.description`)}</Text>
                </div>
              </div>
              <div className={classes.grid}>
                {items.map((capability) => (
                  <CapabilityCard key={capability.id} capability={capability} />
                ))}
              </div>
            </section>
          ))
        ) : (
          <EmptyState icon={<IconCompass size={28} stroke={1.6} />} title={t("discover.emptyTitle")} description={t("discover.emptyHint")}>
            <Button variant="default" size="action" onClick={reset}>
              {t("discover.showAll")}
            </Button>
          </EmptyState>
        )}
      </section>

      <aside className={classes.callout} aria-labelledby="discover-callout-title">
        <ThemeIcon variant="filled" color="charcoal" size={42} radius="xl" aria-hidden>
          <IconMessageCircle size={21} />
        </ThemeIcon>
        <div>
          <Title order={2} id="discover-callout-title" className={classes.calloutTitle}>
            {t("discover.calloutTitle")}
          </Title>
          <Text className={classes.calloutBody}>{t("discover.calloutBody")}</Text>
        </div>
      </aside>
    </div>
  );
};

export default DiscoverPage;
