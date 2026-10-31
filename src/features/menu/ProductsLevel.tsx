import { useEffect, useState } from "react";
import { Alert, Badge, Button, Checkbox, Group, Select, Stack, Switch } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useDebouncedValue } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconInfoCircle, IconSettings } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toApiError } from "@/api/errors";
import { createProduct, deleteProduct, updateProduct, type MenuCategory, type MenuProductDetail, type ProductInput } from "@/api/v2/menu";
import { CurrencyText } from "@/components/money/CurrencyText";
import { useLocalized } from "@/features/pos/hooks/useLocalized";
import { CategoryDrawer } from "./CategoriesLevel";
import {
  DeleteDialog,
  DescriptionFields,
  DetailsLayout,
  Field,
  FormLayout,
  MenuCard,
  MenuDrawer,
  MenuList,
  NameFields,
  OtherName,
  SearchBox,
  SortOrderField,
} from "./MenuParts";
import { descriptionRule, optionalText, requiredName, sortOrderRule, useFieldProps } from "./menuForm";
import { refreshMenu, useMenuCategories, useMenuProducts, useOptionGroups } from "./queries";
import classes from "./Menu.module.css";

type ProductForm = {
  categoryId: string | null;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  sortOrder: number | string;
  usesUnits: boolean;
  optionGroupIds: string[];
};

/**
 * Create or edit a product. Its structure — sold in sizes, and its option groups (dough, pasta type) — decides the
 * variants it can have, so it can only be set while the product has no variant at all (D49, deleted ones included).
 */
const ProductForm = ({ product, categoryId, onDone }: { product?: MenuProductDetail; categoryId?: number; onDone: () => void }) => {
  const { t } = useTranslation();
  const { name } = useLocalized();
  const queryClient = useQueryClient();
  const categories = useMenuCategories();
  const groups = useOptionGroups();
  const structureEditable = !product || product.variants.length === 0;
  const form = useForm<ProductForm>({
    mode: "controlled",
    initialValues: {
      categoryId: product ? String(product.categoryId) : categoryId ? String(categoryId) : null,
      nameEn: product?.nameEn ?? "",
      nameAr: product?.nameAr ?? "",
      descriptionEn: product?.descriptionEn ?? "",
      descriptionAr: product?.descriptionAr ?? "",
      sortOrder: product?.sortOrder ?? 0,
      usesUnits: product?.usesUnits ?? false,
      optionGroupIds: product?.optionGroups.map((group) => String(group.id)) ?? [],
    },
    validate: {
      categoryId: (value) => (value ? null : "menu.validation.required"),
      nameEn: requiredName(191),
      nameAr: requiredName(191),
      descriptionEn: descriptionRule,
      descriptionAr: descriptionRule,
      sortOrder: sortOrderRule,
    },
  });
  const field = useFieldProps(form);
  const save = useMutation({
    mutationFn: (values: ProductForm) => {
      const body: ProductInput = {
        categoryId: Number(values.categoryId),
        nameEn: values.nameEn.trim(),
        nameAr: values.nameAr.trim(),
        descriptionEn: optionalText(values.descriptionEn),
        descriptionAr: optionalText(values.descriptionAr),
        sortOrder: Number(values.sortOrder),
        ...(structureEditable ? { usesUnits: values.usesUnits, optionGroupIds: values.optionGroupIds.map(Number) } : {}),
      };
      return product ? updateProduct(product.id, body) : createProduct(body);
    },
    onSuccess: (saved) => {
      refreshMenu(queryClient);
      notifications.show({ color: "green", message: product ? t("menu.saved") : t("menu.created", { name: name(saved) }) });
      onDone();
    },
  });

  return (
    <FormLayout
      label={t(product ? "menu.editLabel" : "menu.createTitle.products")}
      error={save.error ? toApiError(save.error) : null}
      pending={save.isPending}
      canSave={!product || form.isDirty()}
      onSubmit={form.onSubmit((values) => save.mutate(values))}
      onCancel={onDone}
    >
      <Select
        label={t("menu.fields.category")}
        withAsterisk
        searchable
        data={(categories.data ?? []).map((category) => ({ value: String(category.id), label: name(category) }))}
        {...field("categoryId")}
      />
      <NameFields form={form} max={191} />
      <DescriptionFields form={form} />
      <SortOrderField form={form} />
      {structureEditable ? (
        <Stack gap="xs">
          <Switch label={t("menu.fields.usesUnits")} description={t("menu.fields.usesUnitsHint")} {...form.getInputProps("usesUnits", { type: "checkbox" })} />
          <Checkbox.Group label={t("menu.fields.optionGroups")} description={t("menu.fields.optionGroupsHint")} {...form.getInputProps("optionGroupIds")}>
            <Group gap="md" mt={6}>
              {(groups.data ?? []).map((group) => (
                <Checkbox key={group.id} value={String(group.id)} label={name(group)} />
              ))}
            </Group>
          </Checkbox.Group>
        </Stack>
      ) : (
        <Alert color="gray" variant="light" icon={<IconInfoCircle size={18} />} role="status">
          {t("menu.structureLocked")}
        </Alert>
      )}
    </FormLayout>
  );
};

const ProductDetails = ({ product, onDeleted }: { product: MenuProductDetail; onDeleted: () => void }) => {
  const { t } = useTranslation();
  const { name } = useLocalized();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const remove = useMutation({
    mutationFn: () => deleteProduct(product.id),
    onSuccess: () => {
      setConfirming(false);
      onDeleted();
      refreshMenu(queryClient);
      notifications.show({ color: "green", message: t("menu.deleted", { name: name(product) }) });
    },
    onError: () => setConfirming(false),
  });
  if (editing) return <ProductForm product={product} onDone={() => setEditing(false)} />;

  const variants = product.variants.filter((variant) => !variant.archived);
  const addOns = product.addOns.filter((addOn) => addOn.isActive && addOn.addOnIsActive);
  return (
    <DetailsLayout error={remove.error ? toApiError(remove.error) : null} busy={remove.isPending} onEdit={() => setEditing(true)} onDelete={() => setConfirming(true)}>
      {product.draft ? (
        <Alert color="yellow" variant="light" icon={<IconInfoCircle size={18} />} role="status">
          {t("menu.draftHint")}
        </Alert>
      ) : null}
      <div className={classes.fields}>
        <Field label={t("menu.fields.category")}>{product.category ? name(product.category) : "—"}</Field>
        <Field label={t("menu.fields.sortOrder")}>{product.sortOrder}</Field>
        <Field label={t("menu.fields.nameEn")}>
          <span dir="ltr">{product.nameEn}</span>
        </Field>
        <Field label={t("menu.fields.nameAr")}>
          <span dir="rtl">{product.nameAr}</span>
        </Field>
        <Field label={t("menu.fields.descriptionEn")}>{product.descriptionEn ? <span dir="ltr">{product.descriptionEn}</span> : "—"}</Field>
        <Field label={t("menu.fields.descriptionAr")}>{product.descriptionAr ? <span dir="rtl">{product.descriptionAr}</span> : "—"}</Field>
        <Field label={t("menu.fields.usesUnits")}>{t(product.usesUnits ? "menu.yes" : "menu.no")}</Field>
        <Field label={t("menu.fields.optionGroups")}>{product.optionGroups.length ? product.optionGroups.map((group) => name(group)).join(" · ") : "—"}</Field>
        <Field label={t("menu.tabs.variants")}>{t("menu.variantCount", { count: variants.length })}</Field>
      </div>
      <Field label={t("menu.tabs.addons")}>
        {addOns.length ? (
          <Stack gap={2}>
            {addOns.map((addOn) => (
              <span key={addOn.addOnId}>
                {name(addOn)} · <CurrencyText value={addOn.price} inherit className={classes.money} />
              </span>
            ))}
          </Stack>
        ) : (
          "—"
        )}
      </Field>
      <DeleteDialog
        opened={confirming}
        name={name(product)}
        body={t("menu.deleteBody.products")}
        pending={remove.isPending}
        onConfirm={() => remove.mutate()}
        onClose={() => setConfirming(false)}
      />
    </DetailsLayout>
  );
};

interface ProductDrawerProps {
  opened: boolean;
  /** undefined: a new product, in `categoryId`. */
  product?: MenuProductDetail;
  categoryId?: number;
  onClose: () => void;
  onDeleted: () => void;
}

/** A product's details (edit, delete), or the form of a new product. */
export const ProductDrawer = ({ opened, product, categoryId, onClose, onDeleted }: ProductDrawerProps) => {
  const { t } = useTranslation();
  const { name } = useLocalized();
  return (
    <MenuDrawer opened={opened} onClose={onClose} title={product ? name(product) : t("menu.createTitle.products")}>
      {!opened ? null : product ? (
        <ProductDetails key={product.id} product={product} onDeleted={onDeleted} />
      ) : (
        <ProductForm categoryId={categoryId} onDone={onClose} />
      )}
    </MenuDrawer>
  );
};

interface ProductsLevelProps {
  category: MenuCategory;
  onOpen: (productId: number) => void;
  onCategoryDeleted: () => void;
}

/**
 * Level 2: the products of one category (server-side search and pagination). A card opens the product's options and
 * variants; the category itself is managed from "Category details".
 */
export const ProductsLevel = ({ category, onOpen, onCategoryDeleted }: ProductsLevelProps) => {
  const { t } = useTranslation();
  const { name, arabic } = useLocalized();
  const [searchInput, setSearchInput] = useState("");
  const [search] = useDebouncedValue(searchInput.trim(), 300);
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const query = useMenuProducts(category.id, search, page);
  const totalPages = query.data?.pagination.totalPages ?? 1;
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <>
      <MenuList
        toolbar={
          <>
            <SearchBox
              label={t("menu.search.products")}
              value={searchInput}
              onChange={(value) => {
                setSearchInput(value);
                setPage(1);
              }}
            />
            <Button size="action" variant="default" leftSection={<IconSettings size={18} />} onClick={() => setCategoryOpen(true)}>
              {t("menu.categoryDetails")}
            </Button>
          </>
        }
        addLabel={t("menu.add.products")}
        onAdd={() => setCreating(true)}
        query={query}
        items={query.data?.items}
        countText={t("menu.count.products", { count: query.data?.pagination.total ?? 0 })}
        emptyTitle={searchInput.trim() ? t("menu.emptyFiltered") : t("menu.empty.categoryProducts")}
        pagination={{ page, totalPages, onChange: setPage }}
        renderCard={(product) => {
          const status = product.draft ? t("menu.draft") : t("menu.variantCount", { count: product.variantCount ?? 0 });
          return (
            <MenuCard
              key={product.id}
              label={`${name(product)}, ${status}`}
              title={name(product)}
              subtitle={<OtherName item={product} arabic={arabic} />}
              meta={
                product.draft ? (
                  <Badge component="span" color="yellow" variant="light" radius="sm" tt="none">
                    {status}
                  </Badge>
                ) : (
                  status
                )
              }
              onOpen={() => onOpen(product.id)}
            />
          );
        }}
      />
      <ProductDrawer opened={creating} categoryId={category.id} onClose={() => setCreating(false)} onDeleted={() => setCreating(false)} />
      <CategoryDrawer opened={categoryOpen} category={category} onClose={() => setCategoryOpen(false)} onDeleted={onCategoryDeleted} />
    </>
  );
};
