import { useState } from "react";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { IconPackages } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { toApiError } from "@/api/errors";
import { createCategory, deleteCategory, updateCategory, type MenuCategory } from "@/api/menu";
import { DiscoverTeaser } from "@/features/discover/DiscoverTeaser";
import { useCatalog } from "@/features/pos/hooks/queries";
import { useLocalized } from "@/features/pos/hooks/useLocalized";
import { categoryIcon } from "@/features/pos/model/categoryIcon";
import { DeleteDialog, DetailsLayout, Field, FormLayout, MenuCard, MenuDrawer, MenuList, NameFields, OtherName, SearchBox, SortOrderField } from "./MenuParts";
import { requiredName, sortOrderRule } from "./menuForm";
import { refreshMenu, useMenuCategories } from "./queries";
import classes from "./Menu.module.css";

type CategoryForm = { nameEn: string; nameAr: string; sortOrder: number | string };

/** Create or edit a category: names (English and Arabic) and its position in the POS. */
const CategoryForm = ({ category, onDone }: { category?: MenuCategory; onDone: () => void }) => {
  const { t } = useTranslation();
  const { name } = useLocalized();
  const queryClient = useQueryClient();
  const form = useForm<CategoryForm>({
    mode: "controlled",
    initialValues: { nameEn: category?.nameEn ?? "", nameAr: category?.nameAr ?? "", sortOrder: category?.sortOrder ?? 0 },
    validate: { nameEn: requiredName(191), nameAr: requiredName(191), sortOrder: sortOrderRule },
  });
  const save = useMutation({
    mutationFn: (values: CategoryForm) => {
      const body = { nameEn: values.nameEn.trim(), nameAr: values.nameAr.trim(), sortOrder: Number(values.sortOrder) };
      return category ? updateCategory(category.id, body) : createCategory(body);
    },
    onSuccess: (saved) => {
      refreshMenu(queryClient);
      notifications.show({ color: "green", message: category ? t("menu.saved") : t("menu.created", { name: name(saved) }) });
      onDone();
    },
  });
  return (
    <FormLayout
      label={t(category ? "menu.editLabel" : "menu.createTitle.categories")}
      error={save.error ? toApiError(save.error) : null}
      pending={save.isPending}
      canSave={!category || form.isDirty()}
      onSubmit={form.onSubmit((values) => save.mutate(values))}
      onCancel={onDone}
    >
      <NameFields form={form} max={191} />
      <SortOrderField form={form} />
    </FormLayout>
  );
};

const CategoryDetails = ({ category, onDeleted }: { category: MenuCategory; onDeleted: () => void }) => {
  const { t } = useTranslation();
  const { name } = useLocalized();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const remove = useMutation({
    mutationFn: () => deleteCategory(category.id),
    onSuccess: () => {
      setConfirming(false);
      onDeleted();
      refreshMenu(queryClient);
      notifications.show({ color: "green", message: t("menu.deleted", { name: name(category) }) });
    },
    onError: () => setConfirming(false),
  });
  if (editing) return <CategoryForm category={category} onDone={() => setEditing(false)} />;
  return (
    <DetailsLayout error={remove.error ? toApiError(remove.error) : null} busy={remove.isPending} onEdit={() => setEditing(true)} onDelete={() => setConfirming(true)}>
      <div className={classes.fields}>
        <Field label={t("menu.fields.nameEn")}>
          <span dir="ltr">{category.nameEn}</span>
        </Field>
        <Field label={t("menu.fields.nameAr")}>
          <span dir="rtl">{category.nameAr}</span>
        </Field>
        <Field label={t("menu.fields.sortOrder")}>{category.sortOrder}</Field>
        <Field label={t("menu.tabs.products")}>{category.productCount ?? 0}</Field>
      </div>
      <DeleteDialog
        opened={confirming}
        name={name(category)}
        body={t("menu.deleteBody.categories")}
        pending={remove.isPending}
        onConfirm={() => remove.mutate()}
        onClose={() => setConfirming(false)}
      />
    </DetailsLayout>
  );
};

interface CategoryDrawerProps {
  opened: boolean;
  /** undefined: a new category. */
  category?: MenuCategory;
  onClose: () => void;
  onDeleted: () => void;
}

/** A category's details (edit, delete), or the form of a new category. */
export const CategoryDrawer = ({ opened, category, onClose, onDeleted }: CategoryDrawerProps) => {
  const { t } = useTranslation();
  const { name } = useLocalized();
  return (
    <MenuDrawer opened={opened} onClose={onClose} title={category ? name(category) : t("menu.createTitle.categories")}>
      {!opened ? null : category ? <CategoryDetails key={category.id} category={category} onDeleted={onDeleted} /> : <CategoryForm onDone={onClose} />}
    </MenuDrawer>
  );
};

/**
 * The category picture, without new assets or uploads: the category's own image, else a product photo of the
 * category (POS menu), else the POS's icon for the category. An image that fails to load falls back to the next one.
 */
const CategoryMedia = ({ category, photo }: { category: MenuCategory; photo: string | null }) => {
  const [failed, setFailed] = useState<string[]>([]);
  const src = [category.imageUrl, photo].find((candidate): candidate is string => Boolean(candidate) && !failed.includes(candidate!));
  const Icon = categoryIcon(category);
  return src ? (
    <img src={src} alt="" loading="lazy" className={classes.cardImage} onError={() => setFailed((current) => [...current, src])} />
  ) : (
    <Icon size={34} stroke={1.4} aria-hidden data-testid="category-icon" />
  );
};

/** Level 1: the categories in menu order (a short list, searched in the browser). A card opens its products. */
export const CategoriesLevel = ({ onOpen }: { onOpen: (categoryId: number) => void }) => {
  const { t } = useTranslation();
  const { name, arabic } = useLocalized();
  const query = useMenuCategories();
  const catalog = useCatalog();
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const term = search.trim().toLowerCase();
  const items = query.data?.filter((category) => !term || `${category.nameEn} ${category.nameAr}`.toLowerCase().includes(term));
  const photoOf = (categoryId: number) => catalog.data?.find((category) => category.id === categoryId)?.products.find((product) => product.imageUrl)?.imageUrl ?? null;

  return (
    <>
      <MenuList
        toolbar={<SearchBox label={t("menu.search.categories")} value={search} onChange={setSearch} />}
        addLabel={t("menu.add.categories")}
        onAdd={() => setCreating(true)}
        query={query}
        items={items}
        countText={t("menu.count.categories", { count: items?.length ?? 0 })}
        emptyTitle={term ? t("menu.emptyFiltered") : t("menu.empty.categories")}
        footer={term ? null : <DiscoverTeaser icon={<IconPackages size={21} stroke={1.7} />} title={t("discover.teasers.menu.title")} body={t("discover.teasers.menu.body")} />}
        renderCard={(category) => (
          <MenuCard
            key={category.id}
            label={`${name(category)}, ${t("menu.productCount", { count: category.productCount ?? 0 })}`}
            media={<CategoryMedia category={category} photo={photoOf(category.id)} />}
            title={name(category)}
            subtitle={<OtherName item={category} arabic={arabic} />}
            meta={t("menu.productCount", { count: category.productCount ?? 0 })}
            onOpen={() => onOpen(category.id)}
          />
        )}
      />
      <CategoryDrawer opened={creating} onClose={() => setCreating(false)} onDeleted={() => setCreating(false)} />
    </>
  );
};
