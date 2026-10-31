import { useEffect, useState } from "react";
import { ActionIcon, Button, Select, Stack, Text, Tooltip } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useDebouncedValue } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconX } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toApiError } from "@/api/errors";
import { createAddOn, deleteAddOn, setProductAddOn, updateAddOn, type AddOnInput, type MenuAddOn } from "@/api/v2/menu";
import { CurrencyText } from "@/components/money/CurrencyText";
import { DecimalInput } from "@/features/pos/components/DecimalInput";
import { useLocalized } from "@/features/pos/hooks/useLocalized";
import {
  DeleteDialog,
  DescriptionFields,
  DetailsLayout,
  DrawerStatus,
  Field,
  FormLayout,
  MenuCard,
  MenuDrawer,
  MenuList,
  NameFields,
  OtherName,
  SearchBox,
  type DrawerTarget,
} from "./MenuParts";
import { descriptionRule, menuErrorKey, optionalText, priceRule, requiredName, useFieldProps } from "./menuForm";
import { refreshMenu, useAllMenuProducts, useMenuAddOn, useMenuAddOns } from "./queries";
import classes from "./Menu.module.css";

type AddOnForm = { nameEn: string; nameAr: string; descriptionEn: string; descriptionAr: string };

/** Create or edit an add-on: names and descriptions. Its prices belong to the products it is offered on. */
const AddOnForm = ({ addOn, onDone }: { addOn?: MenuAddOn; onDone: () => void }) => {
  const { t } = useTranslation();
  const { name } = useLocalized();
  const queryClient = useQueryClient();
  const form = useForm<AddOnForm>({
    mode: "controlled",
    initialValues: { nameEn: addOn?.nameEn ?? "", nameAr: addOn?.nameAr ?? "", descriptionEn: addOn?.descriptionEn ?? "", descriptionAr: addOn?.descriptionAr ?? "" },
    validate: { nameEn: requiredName(100), nameAr: requiredName(100), descriptionEn: descriptionRule, descriptionAr: descriptionRule },
  });
  const save = useMutation({
    mutationFn: (values: AddOnForm) => {
      const body: AddOnInput = {
        nameEn: values.nameEn.trim(),
        nameAr: values.nameAr.trim(),
        descriptionEn: optionalText(values.descriptionEn),
        descriptionAr: optionalText(values.descriptionAr),
      };
      return addOn ? updateAddOn(addOn.id, body) : createAddOn(body);
    },
    onSuccess: (saved) => {
      refreshMenu(queryClient);
      notifications.show({ color: "green", message: addOn ? t("menu.saved") : t("menu.created", { name: name(saved) }) });
      onDone();
    },
  });
  return (
    <FormLayout
      label={t(addOn ? "menu.editLabel" : "menu.createTitle.addons")}
      error={save.error ? toApiError(save.error) : null}
      pending={save.isPending}
      canSave={!addOn || form.isDirty()}
      onSubmit={form.onSubmit((values) => save.mutate(values))}
      onCancel={onDone}
    >
      <NameFields form={form} max={100} />
      <DescriptionFields form={form} />
      {!addOn ? (
        <Text size="sm" c="dimmed">
          {t("menu.addOnPricesHint")}
        </Text>
      ) : null}
    </FormLayout>
  );
};

type LinkForm = { productId: string | null; price: string };

/**
 * The products the add-on is offered on, each with its own price (one price for every variant of the product).
 * Saving a price links the add-on to the product; removing it stops offering it there (the link is kept inactive).
 */
const ProductPrices = ({ addOn }: { addOn: MenuAddOn }) => {
  const { t } = useTranslation();
  const { name, pick } = useLocalized();
  const queryClient = useQueryClient();
  const products = useAllMenuProducts();
  const offered = (addOn.products ?? []).filter((link) => link.isActive);
  const form = useForm<LinkForm>({
    mode: "controlled",
    initialValues: { productId: null, price: "" },
    validate: { productId: (value) => (value ? null : "menu.validation.choose"), price: priceRule },
  });
  const field = useFieldProps(form);
  const productName = (productId: number) => {
    const link = addOn.products?.find((candidate) => candidate.productId === productId);
    const product = products.data?.items.find((candidate) => candidate.id === productId);
    return link ? pick(link.productNameEn, link.productNameAr) : product ? name(product) : "";
  };
  const save = useMutation({
    mutationFn: ({ productId, price, isActive }: { productId: number; price: string; isActive: boolean }) => setProductAddOn(productId, addOn.id, { price, isActive }),
    onSuccess: (_, { productId, isActive }) => {
      refreshMenu(queryClient);
      notifications.show({ color: "green", message: t(isActive ? "menu.addOnLinked" : "menu.addOnUnlinked", { name: productName(productId) }) });
      if (isActive) form.reset();
    },
  });
  const error = save.error ? toApiError(save.error) : null;

  return (
    <Stack gap="sm" component="section" aria-label={t("menu.addOnProducts")}>
      <Text size="xs" c="dimmed" fw={600}>
        {t("menu.addOnProducts")}
      </Text>
      {offered.length ? (
        <ul className={classes.links}>
          {offered.map((link) => (
            <li key={link.productId} className={classes.link}>
              <span className={classes.linkName}>{pick(link.productNameEn, link.productNameAr)}</span>
              <CurrencyText value={link.price} size="sm" fw={700} className={classes.money} />
              <Tooltip label={t("menu.addOnRemoveFrom", { name: pick(link.productNameEn, link.productNameAr) })}>
                <ActionIcon
                  size="action"
                  variant="subtle"
                  color="gray"
                  aria-label={t("menu.addOnRemoveFrom", { name: pick(link.productNameEn, link.productNameAr) })}
                  disabled={save.isPending}
                  onClick={() => save.mutate({ productId: link.productId, price: link.price, isActive: false })}
                >
                  <IconX size={16} />
                </ActionIcon>
              </Tooltip>
            </li>
          ))}
        </ul>
      ) : (
        <Text size="sm" c="dimmed">
          {t("menu.addOnNoProducts")}
        </Text>
      )}
      <form
        className={classes.linkForm}
        noValidate
        aria-label={t("menu.addOnSetPrice")}
        onSubmit={form.onSubmit((values) => save.mutate({ productId: Number(values.productId), price: values.price.trim(), isActive: true }))}
      >
        <Select
          label={t("menu.fields.product")}
          searchable
          nothingFoundMessage={t("menu.emptyFiltered")}
          data={(products.data?.items ?? []).map((product) => ({ value: String(product.id), label: product.category ? `${name(product)} · ${name(product.category)}` : name(product) }))}
          {...field("productId")}
          onChange={(value) => {
            form.setFieldValue("productId", value);
            // A product the add-on is already offered on: start from its current price.
            const current = offered.find((link) => String(link.productId) === value);
            if (current) form.setFieldValue("price", current.price);
          }}
        />
        <DecimalInput label={t("menu.fields.price")} integerDigits={7} fractionDigits={3} {...field("price")} value={form.values.price} />
        <Button size="action" type="submit" variant="light" loading={save.isPending}>
          {t("menu.addOnSave")}
        </Button>
      </form>
      {error ? (
        <Text size="sm" c="red.7" role="alert">
          {t(menuErrorKey(error))}
        </Text>
      ) : null}
    </Stack>
  );
};

const AddOnDetails = ({ addOn, onDeleted }: { addOn: MenuAddOn; onDeleted: () => void }) => {
  const { t } = useTranslation();
  const { name } = useLocalized();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const remove = useMutation({
    mutationFn: () => deleteAddOn(addOn.id),
    onSuccess: () => {
      setConfirming(false);
      onDeleted();
      refreshMenu(queryClient);
      notifications.show({ color: "green", message: t("menu.deleted", { name: name(addOn) }) });
    },
    onError: () => setConfirming(false),
  });
  if (editing) return <AddOnForm addOn={addOn} onDone={() => setEditing(false)} />;
  return (
    <DetailsLayout error={remove.error ? toApiError(remove.error) : null} busy={remove.isPending} onEdit={() => setEditing(true)} onDelete={() => setConfirming(true)}>
      <div className={classes.fields}>
        <Field label={t("menu.fields.nameEn")}>
          <span dir="ltr">{addOn.nameEn}</span>
        </Field>
        <Field label={t("menu.fields.nameAr")}>
          <span dir="rtl">{addOn.nameAr}</span>
        </Field>
        <Field label={t("menu.fields.descriptionEn")}>{addOn.descriptionEn ? <span dir="ltr">{addOn.descriptionEn}</span> : "—"}</Field>
        <Field label={t("menu.fields.descriptionAr")}>{addOn.descriptionAr ? <span dir="rtl">{addOn.descriptionAr}</span> : "—"}</Field>
      </div>
      <ProductPrices addOn={addOn} />
      <DeleteDialog
        opened={confirming}
        name={name(addOn)}
        body={t("menu.deleteBody.addons")}
        pending={remove.isPending}
        onConfirm={() => remove.mutate()}
        onClose={() => setConfirming(false)}
      />
    </DetailsLayout>
  );
};

/** Add-ons (not deleted), server-side search and pagination. */
export const AddOnsTab = () => {
  const { t } = useTranslation();
  const { name, arabic } = useLocalized();
  const [searchInput, setSearchInput] = useState("");
  const [search] = useDebouncedValue(searchInput.trim(), 300);
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<DrawerTarget>(null);
  const query = useMenuAddOns(search, page);
  const detail = useMenuAddOn(typeof target === "number" ? target : null);
  const totalPages = query.data?.pagination.totalPages ?? 1;
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);
  const close = () => setTarget(null);

  return (
    <>
      <MenuList
        toolbar={
          <SearchBox
            label={t("menu.search.addons")}
            value={searchInput}
            onChange={(value) => {
              setSearchInput(value);
              setPage(1);
            }}
          />
        }
        addLabel={t("menu.add.addons")}
        onAdd={() => setTarget("new")}
        query={query}
        items={query.data?.items}
        countText={t("menu.count.addons", { count: query.data?.pagination.total ?? 0 })}
        emptyTitle={searchInput.trim() ? t("menu.emptyFiltered") : t("menu.empty.addons")}
        pagination={{ page, totalPages, onChange: setPage }}
        renderCard={(addOn) => (
          <MenuCard key={addOn.id} label={name(addOn)} title={name(addOn)} subtitle={<OtherName item={addOn} arabic={arabic} />} onOpen={() => setTarget(addOn.id)} />
        )}
      />
      <MenuDrawer
        opened={target !== null}
        onClose={close}
        title={target === "new" ? t("menu.createTitle.addons") : detail.data && !detail.isError ? name(detail.data) : t("menu.loading")}
      >
        {target === "new" ? (
          <AddOnForm onDone={close} />
        ) : target === null ? null : detail.data && !detail.isError ? (
          <AddOnDetails key={detail.data.id} addOn={detail.data} onDeleted={close} />
        ) : (
          <DrawerStatus query={detail} />
        )}
      </MenuDrawer>
    </>
  );
};
