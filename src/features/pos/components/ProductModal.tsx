import { useId, useMemo, useRef, useState } from "react";
import { ActionIcon, Badge, Button, Checkbox, Divider, Group, Modal, Radio, Stack, Tabs, Text, Textarea } from "@mantine/core";
import { IconNote, IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type { CatalogProduct, CatalogVariant } from "@/api/catalog";
import { CurrencyText } from "@/components/money/CurrencyText";
import { fromFils } from "@/lib/money";
import { cartReducer, MAX_COMMENT_LENGTH, newLineKey, normalizeConfig, type CartLine, type LineConfig } from "../model/cart";
import { defaultVariant, doughTabs, labelWithoutDough, selectedAddOns, sellableVariants, variantForDough } from "../model/catalogView";
import { orderTotals, priceLine, type LinePrice } from "../model/pricing";
import { useLocalized } from "../hooks/useLocalized";
import { QuantityStepper } from "./QuantityStepper";
import classes from "../Pos.module.css";

export interface ProductEditorTarget {
  product: CatalogProduct;
  /** Present when editing a cart line: the dialog opens with its configuration. */
  line?: LineConfig & { key: string };
}

interface VariantCardsProps {
  variants: CatalogVariant[];
  value: number | null;
  onChange: (variantId: number) => void;
  label: string;
  labelOf: (variant: CatalogVariant) => string;
  compact?: boolean;
}

const VariantCards = ({ variants, value, onChange, label, labelOf, compact = false }: VariantCardsProps) => (
  <Radio.Group value={value === null ? null : String(value)} onChange={(next) => onChange(Number(next))} label={label} labelProps={{ mb: 6, fw: 700 }}>
    <div className={compact ? `${classes.optionGrid} ${classes.sizeGrid}` : classes.optionGrid}>
      {variants.map((variant) => (
        <Radio.Card key={variant.id} value={String(variant.id)} className={classes.choiceCard} radius="md">
          <span className={classes.choiceBody}>
            <Group gap="xs" wrap="nowrap">
              <Radio.Indicator size="sm" />
              <Text fw={600} size="sm">
                {labelOf(variant)}
              </Text>
            </Group>
            <CurrencyText value={variant.price} size="sm" fw={700} className={classes.money} />
          </span>
        </Radio.Card>
      ))}
    </div>
  </Radio.Group>
);

interface StagedRowProps {
  line: CartLine;
  product: CatalogProduct;
  /** Local price of this configuration (null only if the catalog does not sell it). */
  price: LinePrice | null;
  onEdit: (key: string) => void;
  onRemove: (key: string) => void;
  onQuantity: (key: string, quantity: number) => void;
}

/** One configuration waiting in the dialog: dough and size, add-ons, note, quantity and price. */
const StagedRow = ({ line, product, price, onEdit, onRemove, onQuantity }: StagedRowProps) => {
  const { t } = useTranslation();
  const { name, pick } = useLocalized();
  const variant = product.variants.find((candidate) => candidate.id === line.variantId);
  const label = (variant && pick(variant.labelEn, variant.labelAr)) || name(product);
  const addOns = selectedAddOns(product, line.addOnIds);
  return (
    <li className={classes.stagedRow}>
      <div className={classes.stagedInfo}>
        <div className={classes.lineName}>{label}</div>
        {addOns.length || line.comment ? (
          <div className={classes.stagedMeta}>
            {addOns.map((addOn) => `+ ${name(addOn)}`).join(" · ")}
            {line.comment ? (
              <span className={classes.stagedNote} title={line.comment}>
                <IconNote size={13} aria-hidden /> {t("pos.product.note", { note: line.comment })}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className={classes.stagedControls}>
        <QuantityStepper
          value={line.quantity}
          onChange={(quantity) => onQuantity(line.key, quantity)}
          decreaseLabel={t("pos.cart.decrease", { name: label })}
          increaseLabel={t("pos.cart.increase", { name: label })}
          valueLabel={t("pos.cart.quantityOf", { quantity: line.quantity, name: label })}
        />
        {price ? (
          <CurrencyText value={fromFils(price.lineTotalFils)} size="sm" fw={700} className={classes.money} />
        ) : (
          <Text size="sm" fw={700}>
            —
          </Text>
        )}
        <ActionIcon size="action" variant="subtle" color="charcoal" onClick={() => onEdit(line.key)} aria-label={t("pos.cart.edit", { name: label })}>
          <IconPencil size={17} />
        </ActionIcon>
        <ActionIcon size="action" variant="subtle" color="red" onClick={() => onRemove(line.key)} aria-label={t("pos.cart.remove", { name: label })}>
          <IconTrash size={17} />
        </ActionIcon>
      </div>
    </li>
  );
};

const configOf = ({ productId, variantId, addOnIds, quantity, comment }: CartLine): LineConfig => ({ productId, variantId, addOnIds, quantity, comment });

/** The configuration being chosen. `pristine`: reset after "Add another configuration" and not chosen yet. */
interface FormState {
  variantId: number | null;
  addOnIds: number[];
  quantity: number;
  comment: string;
  pristine: boolean;
}

interface ProductEditorProps {
  target: ProductEditorTarget;
  /** Returns false when the configurations were not accepted (the dialog stays open). */
  onSubmit: (configs: LineConfig[]) => boolean;
  onCancel: () => void;
}

/**
 * Variant, add-ons, quantity and note for one product. Only what the catalog offers for this product is shown.
 * Pizzas sold in sizes with several doughs get one tab per dough, each listing the sizes that exist for it.
 *
 * Several configurations can be added in one go: "Add another configuration" keeps the current one in the dialog
 * (identical ones merge) and resets the form with nothing selected, so only what is chosen is ever added. "Add all
 * to order" adds the kept configurations plus the current one, if chosen, to the cart in one update. The total
 * covers exactly those configurations. When editing a cart line, only that line is changed.
 */
const ProductEditor = ({ target, onSubmit, onCancel }: ProductEditorProps) => {
  const { t } = useTranslation();
  const { name, pick } = useLocalized();
  const doughLabelId = useId();
  const stagedLabelId = useId();
  const { product, line } = target;
  const editing = Boolean(line);
  const variants = sellableVariants(product);
  const tabs = useMemo(() => doughTabs(product), [product]);
  const showVariants = variants.length > 1 || Boolean(variants[0]?.labelEn);
  const scrollRef = useRef<HTMLDivElement>(null);
  const submitted = useRef(false);

  const [form, setForm] = useState<FormState>(() => ({
    variantId: line?.variantId ?? defaultVariant(product)?.id ?? null,
    addOnIds: line?.addOnIds ?? [],
    quantity: line?.quantity ?? 1,
    comment: line?.comment ?? "",
    pristine: false,
  }));
  const [staged, setStaged] = useState<CartLine[]>([]);
  const change = (patch: Partial<Omit<FormState, "pristine">>) => setForm((current) => ({ ...current, ...patch, pristine: false }));

  const variant = variants.find((candidate) => candidate.id === form.variantId);
  const active: LineConfig | null =
    variant && !form.pristine ? normalizeConfig({ productId: product.id, variantId: variant.id, addOnIds: form.addOnIds, quantity: form.quantity, comment: form.comment }) : null;
  const configs: LineConfig[] = [...staged.map(configOf), ...(active ? [active] : [])];

  // Local pricing, updated at once: this product's variant and add-on prices from the catalog.
  const prices = configs.map((config) => priceLine(product, config));
  const totals = orderTotals(prices.map((price) => price?.lineTotalFils ?? 0));

  // The tab follows the selected variant, so the selection is always one of the shown sizes.
  const fallbackVariantId = defaultVariant(product)?.id;
  const activeTab = tabs
    ? (tabs.find((tab) => tab.variants.some((candidate) => candidate.id === (form.variantId ?? fallbackVariantId))) ?? tabs[0])
    : null;

  const stage = () => {
    if (!active) return;
    setStaged((current) => cartReducer(current, { type: "add", key: newLineKey(), line: active }));
    setForm({ variantId: showVariants ? null : (fallbackVariantId ?? null), addOnIds: [], quantity: 1, comment: "", pristine: true });
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
      scrollRef.current.focus();
    }
  };

  const editStaged = (key: string) => {
    // A configuration being chosen is kept (staged), never overwritten.
    const kept = active ? cartReducer(staged, { type: "add", key: newLineKey(), line: active }) : staged;
    const row = kept.find((candidate) => candidate.key === key);
    if (!row) return;
    setStaged(kept.filter((candidate) => candidate.key !== key));
    setForm({ variantId: row.variantId, addOnIds: row.addOnIds, quantity: row.quantity, comment: row.comment ?? "", pristine: false });
  };

  const toSubmit = editing ? (active ? [active] : []) : configs;
  const submit = () => {
    if (submitted.current || !toSubmit.length) return;
    submitted.current = true;
    if (!onSubmit(toSubmit)) submitted.current = false;
  };

  const totalLabel = staged.length
    ? `${t("pos.product.total")} · ${t("pos.product.configurations", { count: configs.length })}`
    : `${t("pos.product.total")}${form.quantity > 1 && active ? ` (× ${form.quantity})` : ""}`;

  return (
    <form
      className={classes.dialogForm}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className={classes.dialogScroll} ref={scrollRef} tabIndex={-1}>
        <Stack gap="md">
          {staged.length ? (
            <section aria-labelledby={stagedLabelId}>
              <Group gap="xs" mb={6}>
                <Text id={stagedLabelId} fw={700} size="sm">
                  {t("pos.product.staged")}
                </Text>
                <Badge size="sm" variant="light" color="charcoal" radius="xl" aria-hidden>
                  {staged.length}
                </Badge>
              </Group>
              <ul className={classes.stagedList}>
                {staged.map((stagedLine, position) => (
                  <StagedRow
                    key={stagedLine.key}
                    line={stagedLine}
                    product={product}
                    price={prices[position] ?? null}
                    onEdit={editStaged}
                    onRemove={(key) => setStaged((current) => cartReducer(current, { type: "remove", key }))}
                    onQuantity={(key, quantity) => setStaged((current) => cartReducer(current, { type: "setQuantity", key, quantity }))}
                  />
                ))}
              </ul>
              <Divider mt="md" label={t("pos.product.next")} labelPosition="left" />
            </section>
          ) : null}

          {tabs && activeTab ? (
            <div>
              <Text id={doughLabelId} fw={700} size="sm" mb={6}>
                {t("pos.product.dough")}
              </Text>
              <Tabs
                value={String(activeTab.valueId)}
                onChange={(value) => {
                  const tab = tabs.find((candidate) => String(candidate.valueId) === value);
                  if (tab) change({ variantId: variantForDough(tab, variant).id });
                }}
                variant="pills"
                radius="xl"
                keepMounted={false}
                classNames={{ list: classes.doughTabs, tab: classes.doughTab }}
              >
                <Tabs.List aria-labelledby={doughLabelId}>
                  {tabs.map((tab) => (
                    <Tabs.Tab key={tab.valueId} value={String(tab.valueId)}>
                      {pick(tab.nameEn, tab.nameAr)}
                    </Tabs.Tab>
                  ))}
                </Tabs.List>
                {tabs.map((tab) => (
                  <Tabs.Panel key={tab.valueId} value={String(tab.valueId)} pt="sm">
                    <VariantCards
                      variants={tab.variants}
                      value={form.variantId}
                      onChange={(variantId) => change({ variantId })}
                      label={t("pos.product.size")}
                      labelOf={(candidate) => {
                        const label = labelWithoutDough(candidate);
                        return pick(label.en, label.ar) || name(product);
                      }}
                      compact
                    />
                  </Tabs.Panel>
                ))}
              </Tabs>
            </div>
          ) : showVariants ? (
            <VariantCards
              variants={variants}
              value={form.variantId}
              onChange={(variantId) => change({ variantId })}
              label={t("pos.product.chooseOption")}
              labelOf={(candidate) => pick(candidate.labelEn, candidate.labelAr) || name(product)}
            />
          ) : null}

          {product.addOns.length ? (
            <Checkbox.Group value={form.addOnIds.map(String)} onChange={(values) => change({ addOnIds: values.map(Number) })} label={t("pos.product.addOns")} labelProps={{ mb: 6, fw: 700 }}>
              <div className={classes.optionGrid}>
                {product.addOns.map((addOn) => (
                  <Checkbox.Card key={addOn.addOnId} value={String(addOn.addOnId)} className={classes.choiceCard} radius="md">
                    <span className={classes.choiceBody}>
                      <Group gap="xs" wrap="nowrap">
                        <Checkbox.Indicator size="sm" />
                        <Text fw={600} size="sm">
                          {name(addOn)}
                        </Text>
                      </Group>
                      <Text size="sm" c="dimmed" className={classes.money}>
                        + <CurrencyText value={addOn.price} inherit />
                      </Text>
                    </span>
                  </Checkbox.Card>
                ))}
              </div>
            </Checkbox.Group>
          ) : null}

          <Group justify="space-between" align="center">
            <Text fw={700} size="sm">
              {t("pos.product.quantity")}
            </Text>
            <QuantityStepper value={form.quantity} onChange={(quantity) => change({ quantity })} decreaseLabel={t("pos.product.decrease")} increaseLabel={t("pos.product.increase")} size="md" />
          </Group>

          <Textarea
            label={t("pos.product.notes")}
            labelProps={{ fw: 700 }}
            placeholder={t("pos.product.notesPlaceholder")}
            value={form.comment}
            onChange={(event) => change({ comment: event.currentTarget.value })}
            maxLength={MAX_COMMENT_LENGTH}
            autosize
            minRows={2}
            maxRows={4}
          />
        </Stack>
      </div>

      <div className={classes.dialogFooter}>
        {!editing ? (
          <Button size="action-compact" variant="light" color="charcoal" fullWidth leftSection={<IconPlus size={16} />} disabled={!active} onClick={stage} mb="sm">
            {t("pos.product.addAnother")}
          </Button>
        ) : null}
        <Group justify="space-between" gap="sm">
          <div aria-live="polite">
            <Text size="xs" c="dimmed" fw={600}>
              {totalLabel}
            </Text>
            {configs.length ? (
              <CurrencyText value={fromFils(totals.totalFils)} fw={800} size="xl" className={classes.money} />
            ) : (
              <Text fw={800} size="xl">
                —
              </Text>
            )}
          </div>
          <Group gap="sm" wrap="nowrap" ms="auto">
            <Button size="action" variant="default" onClick={onCancel}>
              {t("pos.product.cancel")}
            </Button>
            <Button size="action" type="submit" disabled={!toSubmit.length} data-autofocus>
              {editing ? t("pos.product.update") : staged.length ? t("pos.product.addAll") : t("pos.product.add")}
            </Button>
          </Group>
        </Group>
      </div>
    </form>
  );
};

interface ProductModalProps {
  target: ProductEditorTarget | null;
  onSubmit: (configs: LineConfig[]) => boolean;
  onClose: () => void;
}

export const ProductModal = ({ target, onSubmit, onClose }: ProductModalProps) => {
  const { name } = useLocalized();
  return (
    <Modal
      opened={target !== null}
      onClose={onClose}
      centered
      size="lg"
      radius="lg"
      title={target ? name(target.product) : null}
      classNames={{ content: classes.dialogContent, body: classes.dialogBody, title: classes.dialogTitle }}
    >
      {target ? <ProductEditor key={`${target.product.id}-${target.line?.key ?? "new"}`} target={target} onSubmit={onSubmit} onCancel={onClose} /> : null}
    </Modal>
  );
};
