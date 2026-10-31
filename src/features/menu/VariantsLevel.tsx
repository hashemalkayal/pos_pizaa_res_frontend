import { useState } from "react";
import { Badge, Button, Checkbox, Select, Tabs, Text } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { IconSettings } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toApiError } from "@/api/errors";
import type { CatalogOptionGroup, CatalogOptionValue, CatalogVariant } from "@/api/v2/catalog";
import { createVariant, deleteVariant, updateVariant, type MenuProductDetail, type VariantInput } from "@/api/v2/menu";
import { CurrencyText } from "@/components/money/CurrencyText";
import { DecimalInput } from "@/features/pos/components/DecimalInput";
import { useLocalized } from "@/features/pos/hooks/useLocalized";
import { DeleteDialog, DetailsLayout, Field, FormLayout, MenuCard, MenuDrawer, MenuList, SortOrderField, type DrawerTarget } from "./MenuParts";
import { priceRule, sortOrderRule, useFieldProps } from "./menuForm";
import { ProductDrawer } from "./ProductsLevel";
import { refreshMenu, useUnits } from "./queries";
import classes from "./Menu.module.css";

type VariantForm = {
  unitId: string | null;
  /** Option group id → chosen value id. */
  optionValues: Record<string, string | null>;
  price: string;
  isDefault: boolean;
  sortOrder: number | string;
};

/** The variant's name in the POS: size and options ("Large · Whole Wheat"), or the product name when it has none. */
const useVariantName = () => {
  const { pick, name } = useLocalized();
  return (variant: CatalogVariant, product: { nameEn: string; nameAr: string }) => pick(variant.labelEn, variant.labelAr) || name(product);
};

/**
 * The option group a product's variants are grouped by (as nested tabs): its first option group, with the values
 * that are active or already used by one of its variants. None for products without option groups.
 */
const groupingOf = (product: MenuProductDetail, variants: CatalogVariant[]): { group: CatalogOptionGroup; values: CatalogOptionValue[] } | null => {
  const group = product.optionGroups[0];
  if (!group) return null;
  const used = new Set(variants.flatMap((variant) => variant.options.filter((option) => option.groupId === group.id).map((option) => option.valueId)));
  return { group, values: group.values.filter((value) => value.isActive || used.has(value.id)) };
};

interface VariantFormProps {
  product: MenuProductDetail;
  variant?: CatalogVariant;
  /** A new variant in an option tab: that option's value, already chosen (group id → value id). */
  preset?: Record<string, number>;
  onDone: () => void;
}

/**
 * Create or edit a variant. Its identity — the size (for products sold in sizes) and one value per option group of
 * the product — is chosen once; afterwards only the price, the default choice and the position change.
 */
const VariantForm = ({ product, variant, preset = {}, onDone }: VariantFormProps) => {
  const { t } = useTranslation();
  const { name } = useLocalized();
  const variantName = useVariantName();
  const queryClient = useQueryClient();
  const units = useUnits();
  const form = useForm<VariantForm>({
    mode: "controlled",
    initialValues: {
      unitId: null,
      optionValues: Object.fromEntries(product.optionGroups.map((group) => [String(group.id), preset[group.id] ? String(preset[group.id]) : null])),
      price: variant?.price ?? "",
      isDefault: variant?.isDefault ?? false,
      sortOrder: variant?.sortOrder ?? 0,
    },
    validate: {
      unitId: (value) => (!variant && product.usesUnits && !value ? "menu.validation.choose" : null),
      optionValues: Object.fromEntries(product.optionGroups.map((group) => [String(group.id), (value: string | null) => (!variant && !value ? "menu.validation.choose" : null)])),
      price: priceRule,
      sortOrder: sortOrderRule,
    },
  });
  const field = useFieldProps(form);
  const save = useMutation({
    mutationFn: (values: VariantForm) => {
      const body: VariantInput = { price: values.price.trim(), isDefault: values.isDefault, sortOrder: Number(values.sortOrder) };
      if (variant) return updateVariant(product.id, variant.id, body);
      return createVariant(product.id, {
        ...body,
        unitId: product.usesUnits ? Number(values.unitId) : null,
        optionValueIds: product.optionGroups.map((group) => Number(values.optionValues[String(group.id)])),
      });
    },
    onSuccess: (saved) => {
      refreshMenu(queryClient);
      notifications.show({ color: "green", message: variant ? t("menu.saved") : t("menu.created", { name: variantName(saved, product) }) });
      onDone();
    },
  });

  return (
    <FormLayout
      label={t(variant ? "menu.editLabel" : "menu.createTitle.variants")}
      error={save.error ? toApiError(save.error) : null}
      pending={save.isPending}
      canSave={!variant || form.isDirty()}
      onSubmit={form.onSubmit((values) => save.mutate(values))}
      onCancel={onDone}
    >
      <Field label={t("menu.fields.product")}>{name(product)}</Field>
      {variant ? (
        <Field label={t("menu.fields.variant")}>{variantName(variant, product)}</Field>
      ) : (
        <>
          {product.optionGroups
            .filter((group) => preset[group.id])
            .map((group) => (
              <Field key={group.id} label={name(group)}>
                {name(group.values.find((value) => value.id === preset[group.id]) ?? group)}
              </Field>
            ))}
          {product.usesUnits ? (
            <Select
              label={t("menu.fields.unit")}
              withAsterisk
              data={(units.data ?? []).filter((unit) => unit.isActive).map((unit) => ({ value: String(unit.id), label: name(unit) }))}
              {...field("unitId")}
            />
          ) : null}
          {product.optionGroups
            .filter((group) => !preset[group.id])
            .map((group) => (
              <Select
                key={group.id}
                label={name(group)}
                withAsterisk
                data={group.values.filter((value) => value.isActive).map((value) => ({ value: String(value.id), label: name(value) }))}
                {...field(`optionValues.${group.id}` as keyof VariantForm & string)}
              />
            ))}
        </>
      )}
      <DecimalInput label={t("menu.fields.price")} withAsterisk integerDigits={7} fractionDigits={3} {...field("price")} value={form.values.price} />
      <Checkbox label={t("menu.fields.isDefault")} description={t("menu.fields.isDefaultHint")} {...form.getInputProps("isDefault", { type: "checkbox" })} />
      <SortOrderField form={form} />
    </FormLayout>
  );
};

const VariantDetails = ({ product, variant, onDeleted }: { product: MenuProductDetail; variant: CatalogVariant; onDeleted: () => void }) => {
  const { t } = useTranslation();
  const { name } = useLocalized();
  const variantName = useVariantName();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const remove = useMutation({
    mutationFn: () => deleteVariant(product.id, variant.id),
    onSuccess: () => {
      setConfirming(false);
      onDeleted();
      refreshMenu(queryClient);
      notifications.show({ color: "green", message: t("menu.deleted", { name: variantName(variant, product) }) });
    },
    onError: () => setConfirming(false),
  });
  if (editing) return <VariantForm product={product} variant={variant} onDone={() => setEditing(false)} />;
  return (
    <DetailsLayout error={remove.error ? toApiError(remove.error) : null} busy={remove.isPending} onEdit={() => setEditing(true)} onDelete={() => setConfirming(true)}>
      <div className={classes.fields}>
        <Field label={t("menu.fields.product")}>{name(product)}</Field>
        <Field label={t("menu.fields.price")}>
          <CurrencyText value={variant.price} inherit className={classes.money} />
        </Field>
        {product.usesUnits ? <Field label={t("menu.fields.unit")}>{variant.unit ? name(variant.unit) : "—"}</Field> : null}
        {variant.options.map((option) => (
          <Field key={option.groupId} label={name(product.optionGroups.find((group) => group.id === option.groupId) ?? { nameEn: option.group, nameAr: option.group })}>
            {name(option)}
          </Field>
        ))}
        <Field label={t("menu.fields.isDefault")}>{t(variant.isDefault ? "menu.yes" : "menu.no")}</Field>
        <Field label={t("menu.fields.sortOrder")}>{variant.sortOrder}</Field>
        <Field label={t("menu.fields.sku")}>
          <span dir="ltr">{variant.sku}</span>
        </Field>
      </div>
      <DeleteDialog
        opened={confirming}
        name={variantName(variant, product)}
        body={t("menu.deleteBody.variants")}
        pending={remove.isPending}
        onConfirm={() => remove.mutate()}
        onClose={() => setConfirming(false)}
      />
    </DetailsLayout>
  );
};

interface VariantsLevelProps {
  product: MenuProductDetail;
  /** The option tab shown (an option value id), when the product has option groups. */
  optionId: number | null;
  onOption: (optionId: number) => void;
  onProductDeleted: () => void;
}

/**
 * Level 3–4: a product's variants with their sizes and prices. A product with option groups shows one tab per value of
 * its first group (e.g. Regular / Whole Wheat dough) and the variants of the chosen value; otherwise all its variants.
 * The product itself is managed from "Product details".
 */
export const VariantsLevel = ({ product, optionId, onOption, onProductDeleted }: VariantsLevelProps) => {
  const { t } = useTranslation();
  const { name, pick } = useLocalized();
  const variantName = useVariantName();
  const [target, setTarget] = useState<DrawerTarget>(null);
  const [productOpen, setProductOpen] = useState(false);
  const variants = product.variants.filter((variant) => !variant.archived);
  const grouping = groupingOf(product, variants);
  const option = grouping ? (grouping.values.find((value) => value.id === optionId) ?? grouping.values[0]) : undefined;
  const shown = grouping && option ? variants.filter((variant) => variant.options.some((o) => o.groupId === grouping.group.id && o.valueId === option.id)) : variants;
  const open = typeof target === "number" ? variants.find((variant) => variant.id === target) : undefined;
  const close = () => setTarget(null);

  /** On a card: the size and the options other than the tab's ("Large"), else the full name. */
  const cardTitle = (variant: CatalogVariant) =>
    [variant.unit ? name(variant.unit) : null, ...variant.options.filter((o) => o.groupId !== grouping?.group.id).map((o) => name(o))].filter(Boolean).join(" · ") ||
    pick(variant.labelEn, variant.labelAr) ||
    name(product);

  return (
    <>
      <MenuList
        header={
          grouping && option ? (
            <Tabs value={String(option.id)} onChange={(value) => value && onOption(Number(value))} variant="pills" radius="md" className={classes.optionTabs}>
              <Tabs.List aria-label={name(grouping.group)}>
                {grouping.values.map((value) => (
                  <Tabs.Tab key={value.id} value={String(value.id)} fw={600}>
                    {name(value)}
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs>
          ) : null
        }
        toolbar={
          <>
            <Text fw={700} className={classes.sectionTitle}>
              {t(product.usesUnits ? "menu.sizesAndPrices" : "menu.prices")}
            </Text>
            <Button size="action" variant="default" leftSection={<IconSettings size={18} />} onClick={() => setProductOpen(true)}>
              {t("menu.productDetails")}
            </Button>
          </>
        }
        addLabel={t("menu.add.variants")}
        onAdd={() => setTarget("new")}
        query={{ isPending: false, isError: false, error: null, refetch: () => undefined }}
        items={shown}
        countText={t("menu.count.variants", { count: shown.length })}
        emptyTitle={variants.length ? t("menu.empty.optionVariants") : t("menu.empty.variants")}
        renderCard={(variant) => {
          const title = cardTitle(variant);
          return (
            <MenuCard
              key={variant.id}
              label={[title, variant.price, variant.isDefault ? t("menu.default") : null].filter(Boolean).join(", ")}
              title={title}
              subtitle={<CurrencyText value={variant.price} inherit className={classes.money} />}
              meta={
                <>
                  {variant.isDefault ? (
                    <Badge component="span" color="charcoal" variant="light" radius="sm" tt="none">
                      {t("menu.default")}
                    </Badge>
                  ) : null}
                  <Text span size="xs" c="dimmed" dir="ltr">
                    {variant.sku}
                  </Text>
                </>
              }
              onOpen={() => setTarget(variant.id)}
            />
          );
        }}
      />
      <MenuDrawer
        opened={target !== null}
        onClose={close}
        title={target === "new" ? t("menu.createTitle.variants") : open ? `${name(product)} · ${variantName(open, product)}` : t("menu.loading")}
      >
        {target === "new" ? (
          <VariantForm product={product} preset={grouping && option ? { [grouping.group.id]: option.id } : undefined} onDone={close} />
        ) : open ? (
          <VariantDetails key={open.id} product={product} variant={open} onDeleted={close} />
        ) : null}
      </MenuDrawer>
      <ProductDrawer opened={productOpen} product={product} onClose={() => setProductOpen(false)} onDeleted={onProductDeleted} />
    </>
  );
};
