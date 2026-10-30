import { memo, useMemo, useState, type Ref } from "react";
import { ActionIcon, Badge, Button, Kbd, ScrollArea, TextInput } from "@mantine/core";
import {
  IconBaguette,
  IconBottle,
  IconBowlSpoon,
  IconBread,
  IconChefHat,
  IconFlask,
  IconPizza,
  IconSalad,
  IconSearch,
  IconToolsKitchen2,
  IconX,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type { CatalogCategory, CatalogProduct } from "@/api/v2/catalog";
import { CurrencyText } from "@/components/money/CurrencyText";
import { EmptyState } from "@/components/feedback/EmptyState";
import { isSellable, matchesSearch, sellableVariants, startingPrice } from "../model/catalogView";
import { useLocalized } from "../hooks/useLocalized";
import classes from "../Pos.module.css";

/** Placeholder art for products without a photo, by category (the catalog has no photos yet). */
const categoryIcon = (category: CatalogCategory) => {
  const name = category.nameEn.toLowerCase();
  if (name.includes("pizza")) return IconPizza;
  if (name.includes("pasta")) return IconBowlSpoon;
  if (name.includes("salad")) return IconSalad;
  if (name.includes("drink")) return IconBottle;
  if (name.includes("sandwich")) return IconBaguette;
  if (name.includes("manak") || name.includes("bread")) return IconBread;
  if (name.includes("lab")) return IconFlask;
  if (name.includes("staff")) return IconChefHat;
  return IconToolsKitchen2;
};

interface ProductCardProps {
  product: CatalogProduct;
  category: CatalogCategory;
  onSelect: (productId: number) => void;
}

const ProductCard = memo(({ product, category, onSelect }: ProductCardProps) => {
  const { t } = useTranslation();
  const { name } = useLocalized();
  const price = startingPrice(product);
  const options = sellableVariants(product).length;
  const Icon = categoryIcon(category);
  return (
    <button type="button" className={classes.card} onClick={() => onSelect(product.id)}>
      <span className={classes.cardMedia}>
        {product.imageUrl ? (
          <img src={product.imageUrl} alt="" loading="lazy" className={classes.cardImage} />
        ) : (
          <Icon size={34} stroke={1.4} aria-hidden />
        )}
      </span>
      <span className={classes.cardBody}>
        <span className={classes.cardName}>{name(product)}</span>
        <span className={classes.cardFooter}>
          {price ? (
            <span className={classes.cardPrice}>
              {price.varies ? (
                <>
                  {t("pos.browser.from")} <CurrencyText value={price.price} inherit />
                </>
              ) : (
                <CurrencyText value={price.price} inherit />
              )}
            </span>
          ) : null}
          {options > 1 ? (
            <Badge size="sm" variant="light" color="charcoal" radius="sm" tt="none">
              {t("pos.browser.options", { count: options })}
            </Badge>
          ) : product.addOns.length ? (
            <Badge size="sm" variant="light" color="brand" radius="sm" tt="none">
              {t("pos.browser.addOnsAvailable")}
            </Badge>
          ) : null}
        </span>
      </span>
    </button>
  );
});
ProductCard.displayName = "ProductCard";

interface ProductBrowserProps {
  categories: CatalogCategory[];
  onSelect: (productId: number) => void;
  searchRef: Ref<HTMLInputElement>;
}

/** Search, category strip and product grid. Search looks in every category, in English and Arabic. */
export const ProductBrowser = memo(({ categories, onSelect, searchRef }: ProductBrowserProps) => {
  const { t } = useTranslation();
  const { name } = useLocalized();
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<number | "all">("all");

  const sellable = useMemo(
    () => categories.map((category) => ({ category, products: category.products.filter(isSellable) })).filter((group) => group.products.length > 0),
    [categories]
  );

  const visible = useMemo(() => {
    const searching = query.trim().length > 0;
    return sellable
      .filter((group) => searching || activeCategory === "all" || group.category.id === activeCategory)
      .flatMap((group) => group.products.filter((product) => !searching || matchesSearch(product, query)).map((product) => ({ product, category: group.category })));
  }, [sellable, query, activeCategory]);

  const selectCategory = (id: number | "all") => {
    setActiveCategory(id);
    setQuery("");
  };

  return (
    <section className={classes.browser} aria-label={t("pos.browser.label")}>
      <div className={classes.toolbar}>
        <TextInput
          ref={searchRef}
          value={query}
          onChange={(event) => {
            setQuery(event.currentTarget.value);
            if (event.currentTarget.value.trim()) setActiveCategory("all");
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setQuery("");
          }}
          aria-label={t("pos.browser.searchLabel")}
          placeholder={t("pos.browser.searchPlaceholder")}
          leftSection={<IconSearch size={18} aria-hidden />}
          rightSection={
            query ? (
              <ActionIcon variant="subtle" color="gray" onClick={() => setQuery("")} aria-label={t("pos.browser.clearSearch")}>
                <IconX size={16} />
              </ActionIcon>
            ) : (
              <Kbd size="xs" aria-hidden title={t("pos.browser.searchShortcut")}>
                /
              </Kbd>
            )
          }
          size="md"
          radius="md"
        />
        <ScrollArea type="hover" scrollbarSize={6} offsetScrollbars="x">
          <div className={classes.categories} role="group" aria-label={t("pos.browser.categories")}>
            <button type="button" className={classes.category} data-active={activeCategory === "all" || undefined} aria-pressed={activeCategory === "all"} onClick={() => selectCategory("all")}>
              {t("pos.browser.all")}
            </button>
            {sellable.map(({ category, products }) => (
              <button
                key={category.id}
                type="button"
                className={classes.category}
                data-active={activeCategory === category.id || undefined}
                aria-pressed={activeCategory === category.id}
                onClick={() => selectCategory(category.id)}
              >
                {name(category)}{" "}
                <span className={classes.categoryCount}>{products.length}</span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      <ScrollArea className={classes.gridScroll} type="auto" scrollbarSize={8}>
        {visible.length ? (
          <div className={classes.grid}>
            {visible.map(({ product, category }) => (
              <ProductCard key={product.id} product={product} category={category} onSelect={onSelect} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<IconSearch size={26} stroke={1.6} />}
            title={query.trim() ? t("pos.browser.empty", { query: query.trim() }) : t("pos.browser.emptyCategory")}
          >
            {query.trim() ? (
              <Button size="action" variant="default" onClick={() => setQuery("")}>
                {t("pos.browser.clearSearch")}
              </Button>
            ) : null}
          </EmptyState>
        )}
      </ScrollArea>
    </section>
  );
});
ProductBrowser.displayName = "ProductBrowser";
