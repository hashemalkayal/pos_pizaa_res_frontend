import { Anchor, Breadcrumbs, Button, Text } from "@mantine/core";
import { IconArrowLeft, IconChevronRight, IconToolsKitchen2 } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { toApiError } from "@/api/errors";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { useLocalized } from "@/features/pos/hooks/useLocalized";
import { CategoriesLevel } from "./CategoriesLevel";
import { ProductsLevel } from "./ProductsLevel";
import { useMenuCategories, useMenuProduct } from "./queries";
import { VariantsLevel } from "./VariantsLevel";
import classes from "./Menu.module.css";

type Place = { category?: number; product?: number; option?: number };

const idParam = (value: string | null) => (value && /^[1-9]\d{0,9}$/.test(value) ? Number(value) : null);

/**
 * The Menu tab: Categories → a category's products → a product's option tabs and variants (sizes and prices). The
 * place is kept in the address (?category=&product=&option=), so the browser's Back button and a reload keep it;
 * the Back button and the breadcrumbs go up a level.
 */
export const MenuBrowser = () => {
  const { t } = useTranslation();
  const { name } = useLocalized();
  const [params, setParams] = useSearchParams();
  const categoryId = idParam(params.get("category"));
  const productId = idParam(params.get("product"));
  const optionId = idParam(params.get("option"));
  const categories = useMenuCategories();
  const product = useMenuProduct(productId);
  // A new level is a new history entry; switching option tabs replaces it.
  const go = (place: Place, replace = false) =>
    setParams(Object.fromEntries(Object.entries(place).flatMap(([key, value]) => (value === undefined ? [] : [[key, String(value)]]))), { replace });

  // At the product level the product's own category is shown (it may have been moved to another one).
  const shownCategoryId = product.data?.categoryId ?? categoryId;
  const category = categories.data?.find((candidate) => candidate.id === shownCategoryId);
  const level = productId !== null ? "product" : categoryId !== null ? "category" : "categories";
  const toCategory = () => go(shownCategoryId ? { category: shownCategoryId } : {});
  const back = level === "product" ? toCategory : () => go({});

  const crumbs = [
    { key: "categories", label: t("menu.tabs.categories"), onClick: level === "categories" ? undefined : () => go({}) },
    ...(level !== "categories" ? [{ key: "category", label: category ? name(category) : "…", onClick: level === "product" ? toCategory : undefined }] : []),
    ...(level === "product" ? [{ key: "product", label: product.data ? name(product.data) : "…", onClick: undefined }] : []),
  ];

  const missing = (query: { isPending: boolean; isError: boolean; error: unknown; refetch: () => unknown }, found: boolean) =>
    query.isPending ? (
      <LoadingState label={t("menu.loading")} />
    ) : query.isError && toApiError(query.error).kind !== "notFound" ? (
      <ErrorState error={query.error} onRetry={() => void query.refetch()} />
    ) : !found ? (
      <EmptyState icon={<IconToolsKitchen2 size={28} stroke={1.6} />} title={t("menu.notFound")} />
    ) : null;

  return (
    <>
      <div className={classes.levelBar}>
        {level !== "categories" ? (
          <Button size="action-compact" variant="subtle" color="charcoal" leftSection={<IconArrowLeft size={18} className={classes.mirror} />} onClick={back}>
            {t("menu.back")}
          </Button>
        ) : null}
        <nav aria-label={t("menu.breadcrumbs")} className={classes.crumbs}>
          <Breadcrumbs separator={<IconChevronRight size={16} className={classes.mirror} aria-hidden />} separatorMargin={6}>
            {crumbs.map((crumb) =>
              crumb.onClick ? (
                <Anchor key={crumb.key} component="button" type="button" c="charcoal" fw={600} onClick={crumb.onClick}>
                  {crumb.label}
                </Anchor>
              ) : (
                <Text key={crumb.key} component="h2" className={classes.crumbCurrent} aria-current="page">
                  {crumb.label}
                </Text>
              )
            )}
          </Breadcrumbs>
        </nav>
      </div>

      {level === "categories" ? (
        <CategoriesLevel onOpen={(id) => go({ category: id })} />
      ) : level === "category" ? (
        category ? (
          <ProductsLevel key={category.id} category={category} onOpen={(id) => go({ category: category.id, product: id })} onCategoryDeleted={() => go({})} />
        ) : (
          <div className={classes.results}>{missing(categories, false)}</div>
        )
      ) : product.data && !product.isError && !product.data.archived ? (
        <VariantsLevel
          key={product.data.id}
          product={product.data}
          optionId={optionId}
          onOption={(option) => go({ category: product.data!.categoryId, product: product.data!.id, option }, true)}
          onProductDeleted={toCategory}
        />
      ) : (
        <div className={classes.results}>{missing(product, false)}</div>
      )}
    </>
  );
};
