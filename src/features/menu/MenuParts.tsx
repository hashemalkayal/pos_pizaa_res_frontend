import { type FormEventHandler, type ReactNode } from "react";
import { Alert, Button, CloseButton, Drawer, Group, Modal, NumberInput, Pagination, Stack, Text, Textarea, TextInput, useMatches } from "@mantine/core";
import type { UseFormReturnType } from "@mantine/form";
import { IconAlertTriangle, IconPencil, IconPlus, IconSearch, IconToolsKitchen2, IconTrash } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { toApiError, type ApiError } from "@/api/errors";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { menuErrorKey, useFieldProps } from "./menuForm";
import classes from "./Menu.module.css";

/** Shared building blocks of the four Menu tabs: the same list, card and drawer patterns as Orders and Customers. */

/** What a tab's drawer shows: a new record, an existing one (by id), or nothing. */
export type DrawerTarget = "new" | number | null;

// ─── List ───

interface MenuListProps<T> {
  /** Above the toolbar (e.g. a product's option tabs). */
  header?: ReactNode;
  toolbar: ReactNode;
  addLabel: string;
  onAdd: () => void;
  addDisabled?: boolean;
  query: { isPending: boolean; isError: boolean; error: unknown; refetch: () => unknown; isPlaceholderData?: boolean };
  items: T[] | undefined;
  countText?: string;
  emptyTitle: string;
  emptyAction?: ReactNode;
  /** Shown instead of the list (e.g. "choose a product first"). */
  notice?: ReactNode;
  renderCard: (item: T) => ReactNode;
  pagination?: { page: number; totalPages: number; onChange: (page: number) => void };
  /** After the cards, inside the scrolling list (e.g. a note about planned modules). */
  footer?: ReactNode;
}

/** Toolbar (search + Add), count, cards that scroll, and the pagination at the bottom — the Orders/Customers frame. */
export const MenuList = <T,>({ header, toolbar, addLabel, onAdd, addDisabled, query, items, countText, emptyTitle, emptyAction, notice, renderCard, pagination, footer }: MenuListProps<T>) => {
  const { t } = useTranslation();
  const compactPagination = useMatches({ base: true, sm: false });
  return (
    <>
      {header}
      <div className={classes.toolbar}>
        {toolbar}
        <Button className={classes.addButton} size="action" leftSection={<IconPlus size={18} />} onClick={onAdd} disabled={addDisabled}>
          {addLabel}
        </Button>
      </div>
      {!notice && items?.length && countText ? (
        <Text size="sm" c="dimmed" aria-live="polite">
          {countText}
        </Text>
      ) : null}
      <div className={classes.results}>
        {notice ? (
          notice
        ) : query.isPending ? (
          <LoadingState label={t("menu.loading")} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : !items?.length ? (
          <EmptyState icon={<IconToolsKitchen2 size={28} stroke={1.6} />} title={emptyTitle}>
            {emptyAction}
          </EmptyState>
        ) : (
          <>
            <div className={classes.grid} data-stale={query.isPlaceholderData || undefined}>
              {items.map(renderCard)}
            </div>
            {footer ? <div className={classes.listFooter}>{footer}</div> : null}
          </>
        )}
      </div>
      {!notice && pagination && items?.length ? (
        <Pagination
          className={classes.pagination}
          value={Math.min(pagination.page, pagination.totalPages)}
          onChange={pagination.onChange}
          total={pagination.totalPages}
          size={compactPagination ? "md" : "lg"}
          siblings={compactPagination ? 0 : 1}
          radius="md"
          getControlProps={(control) => ({ "aria-label": t(`menu.pagination.${control}`) })}
        />
      ) : null}
    </>
  );
};

/** The search box of a tab (name in English or Arabic). */
export const SearchBox = ({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) => {
  const { t } = useTranslation();
  return (
    <TextInput
      className={classes.search}
      aria-label={label}
      placeholder={t("menu.searchPlaceholder")}
      leftSection={<IconSearch size={18} aria-hidden />}
      rightSection={value ? <CloseButton aria-label={t("menu.clearSearch")} onClick={() => onChange("")} /> : null}
      rightSectionPointerEvents="all"
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
      maxLength={100}
      size="md"
    />
  );
};

interface MenuCardProps {
  /** Accessible name: the card's texts, separated. */
  label: string;
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  /** Picture strip on top (category cards). */
  media?: ReactNode;
  onOpen: () => void;
}

/** One record of a list. The whole card opens it (its drawer, or its next level); no actions on the card itself. */
export const MenuCard = ({ label, title, subtitle, meta, media, onOpen }: MenuCardProps) => (
  <button type="button" className={classes.card} aria-label={label} onClick={onOpen}>
    {media ? <span className={classes.cardMedia}>{media}</span> : null}
    <span className={classes.cardTitle}>{title}</span>
    {subtitle ? <span className={classes.cardSub}>{subtitle}</span> : null}
    {meta ? <span className={classes.cardMeta}>{meta}</span> : null}
  </button>
);

// ─── Drawer ───

/** Side drawer on the end side (right in English; Mantine mirrors it to the left in Arabic). */
export const MenuDrawer = ({ opened, onClose, title, children }: { opened: boolean; onClose: () => void; title: ReactNode; children: ReactNode }) => {
  const { t } = useTranslation();
  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="md"
      title={title}
      classNames={{ content: classes.drawerContent, body: classes.drawerBody, title: classes.dialogTitle }}
      closeButtonProps={{ "aria-label": t("menu.close") }}
    >
      {children}
    </Drawer>
  );
};

/** The drawer's states while its record loads: loading, missing (deleted meanwhile) or failed. */
export const DrawerStatus = ({ query }: { query: { isError: boolean; error: unknown; refetch: () => unknown } }) => {
  const { t } = useTranslation();
  if (!query.isError) return <LoadingState label={t("menu.loading")} />;
  if (toApiError(query.error).kind === "notFound") return <EmptyState icon={<IconToolsKitchen2 size={28} stroke={1.6} />} title={t("menu.notFound")} />;
  return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
};

export const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <div>
    <Text size="xs" c="dimmed" fw={600}>
      {label}
    </Text>
    <Text component="div" size="sm" fw={600} style={{ overflowWrap: "anywhere" }}>
      {children}
    </Text>
  </div>
);

const ErrorAlert = ({ error }: { error: ApiError | null }) => {
  const { t } = useTranslation();
  return error ? (
    <Alert color="red" variant="light" icon={<IconAlertTriangle size={18} />} role="alert">
      {t(menuErrorKey(error))}
    </Alert>
  ) : null;
};

interface DetailsLayoutProps {
  children: ReactNode;
  error?: ApiError | null;
  onEdit: () => void;
  onDelete: () => void;
  busy?: boolean;
}

/** A record in the drawer: its details, with Delete and Edit in the footer. */
export const DetailsLayout = ({ children, error = null, onEdit, onDelete, busy }: DetailsLayoutProps) => {
  const { t } = useTranslation();
  return (
    <div className={classes.drawerLayout}>
      <div className={classes.drawerScroll}>
        <Stack gap="lg">
          <ErrorAlert error={error} />
          {children}
        </Stack>
      </div>
      <div className={classes.drawerFooter}>
        <Button size="action" variant="light" color="red" leftSection={<IconTrash size={16} />} disabled={busy} onClick={onDelete}>
          {t("menu.delete")}
        </Button>
        <Button size="action" className={classes.footerEnd} leftSection={<IconPencil size={16} />} disabled={busy} onClick={onEdit}>
          {t("menu.edit")}
        </Button>
      </div>
    </div>
  );
};

interface FormLayoutProps {
  children: ReactNode;
  label: string;
  error?: ApiError | null;
  pending: boolean;
  /** False while nothing changed (editing). */
  canSave?: boolean;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onCancel: () => void;
}

/** A create or edit form in the drawer. Saved only with Save; Cancel or closing the drawer discards it. */
export const FormLayout = ({ children, label, error = null, pending, canSave = true, onSubmit, onCancel }: FormLayoutProps) => {
  const { t } = useTranslation();
  return (
    <form className={classes.drawerLayout} onSubmit={onSubmit} noValidate aria-label={label}>
      <div className={classes.drawerScroll}>
        <Stack gap="md">
          {children}
          <ErrorAlert error={error} />
        </Stack>
      </div>
      <div className={classes.drawerFooter}>
        <Button size="action" variant="default" onClick={onCancel} disabled={pending}>
          {t("menu.cancel")}
        </Button>
        <Button size="action" type="submit" className={classes.footerEnd} disabled={!canSave} loading={pending}>
          {t("menu.save")}
        </Button>
      </div>
    </form>
  );
};

interface DeleteDialogProps {
  opened: boolean;
  name: string;
  body: string;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/** Confirmation of a delete (always a soft delete). */
export const DeleteDialog = ({ opened, name, body, pending, onConfirm, onClose }: DeleteDialogProps) => {
  const { t } = useTranslation();
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      centered
      radius="lg"
      title={t("menu.deleteTitle", { name })}
      classNames={{ title: classes.dialogTitle }}
      closeOnEscape={!pending}
      closeOnClickOutside={!pending}
      withCloseButton={!pending}
    >
      <Stack gap="md">
        <Text size="sm">{body}</Text>
        <Group justify="flex-end" gap="sm">
          <Button size="action" variant="default" onClick={onClose} disabled={pending}>
            {t("menu.deleteKeep")}
          </Button>
          <Button size="action" color="red" loading={pending} onClick={onConfirm}>
            {t("menu.deleteConfirm")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

// ─── Form fields ───

type Names = { nameEn: string; nameAr: string };
type Descriptions = { descriptionEn: string; descriptionAr: string };

/** English and Arabic names (both required by the backend). */
export const NameFields = <T extends Names>({ form, max }: { form: UseFormReturnType<T>; max: number }) => {
  const { t } = useTranslation();
  const field = useFieldProps(form);
  return (
    <>
      <TextInput label={t("menu.fields.nameEn")} withAsterisk dir="ltr" maxLength={max} data-autofocus {...field("nameEn")} />
      <TextInput label={t("menu.fields.nameAr")} withAsterisk dir="rtl" maxLength={max} {...field("nameAr")} />
    </>
  );
};

export const DescriptionFields = <T extends Descriptions>({ form }: { form: UseFormReturnType<T> }) => {
  const { t } = useTranslation();
  const field = useFieldProps(form);
  return (
    <>
      <Textarea label={t("menu.fields.descriptionEn")} dir="ltr" autosize minRows={2} maxRows={5} {...field("descriptionEn")} />
      <Textarea label={t("menu.fields.descriptionAr")} dir="rtl" autosize minRows={2} maxRows={5} {...field("descriptionAr")} />
    </>
  );
};

/** Position in the POS (lower first), as the backend sorts categories, products and variants. */
export const SortOrderField = <T extends { sortOrder: number | string }>({ form }: { form: UseFormReturnType<T> }) => {
  const { t } = useTranslation();
  const field = useFieldProps(form);
  return (
    <NumberInput
      label={t("menu.fields.sortOrder")}
      description={t("menu.fields.sortOrderHint")}
      min={0}
      max={100_000}
      allowDecimal={false}
      allowNegative={false}
      dir="ltr"
      {...field("sortOrder")}
    />
  );
};

/** The other language's name, as a card subtitle (both are always entered). */
export const OtherName = ({ item, arabic }: { item: Names; arabic: boolean }) => <span dir={arabic ? "ltr" : "rtl"}>{arabic ? item.nameEn : item.nameAr}</span>;
