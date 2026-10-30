import { useId, useMemo, useState } from "react";
import { Button, Checkbox, Group, Modal, Radio, Stack, Tabs, Text, Textarea } from "@mantine/core";
import { useTranslation } from "react-i18next";
import type { CatalogProduct, CatalogVariant } from "@/api/v2/catalog";
import { CurrencyText } from "@/components/money/CurrencyText";
import { fromFils } from "@/lib/money";
import { MAX_COMMENT_LENGTH, type LineConfig } from "../model/cart";
import { defaultVariant, doughTabs, labelWithoutDough, linePreviewFils, selectedAddOns, sellableVariants, variantForDough } from "../model/catalogView";
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
  value: number;
  onChange: (variantId: number) => void;
  label: string;
  labelOf: (variant: CatalogVariant) => string;
  compact?: boolean;
}

const VariantCards = ({ variants, value, onChange, label, labelOf, compact = false }: VariantCardsProps) => (
  <Radio.Group value={String(value)} onChange={(next) => onChange(Number(next))} label={label} labelProps={{ mb: 6, fw: 700 }}>
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

interface ProductEditorProps {
  target: ProductEditorTarget;
  onSubmit: (config: LineConfig) => void;
  onCancel: () => void;
}

/**
 * Variant, add-ons, quantity and note for one product. Only what the catalog offers for this product is shown.
 * Pizzas sold in sizes with several doughs get one tab per dough, each listing the sizes that exist for it.
 */
const ProductEditor = ({ target, onSubmit, onCancel }: ProductEditorProps) => {
  const { t } = useTranslation();
  const { name, pick } = useLocalized();
  const doughLabelId = useId();
  const { product, line } = target;
  const variants = sellableVariants(product);
  const tabs = useMemo(() => doughTabs(product), [product]);
  const [variantId, setVariantId] = useState(() => line?.variantId ?? defaultVariant(product)?.id ?? 0);
  const [addOnIds, setAddOnIds] = useState<number[]>(() => line?.addOnIds ?? []);
  const [quantity, setQuantity] = useState(() => line?.quantity ?? 1);
  const [comment, setComment] = useState(() => line?.comment ?? "");

  const variant = variants.find((candidate) => candidate.id === variantId);
  const addOns = selectedAddOns(product, addOnIds);
  const showVariants = variants.length > 1 || Boolean(variants[0]?.labelEn);
  // The tab follows the selected variant, so the selection is always one of the shown sizes.
  const activeTab = tabs ? (tabs.find((tab) => tab.variants.some((candidate) => candidate.id === variantId)) ?? tabs[0]) : null;

  const submit = () => {
    if (!variant) return;
    onSubmit({ productId: product.id, variantId: variant.id, addOnIds, quantity, comment: comment.trim() || null });
  };

  return (
    <form
      className={classes.dialogForm}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className={classes.dialogScroll}>
        <Stack gap="md">
          {tabs && activeTab ? (
            <div>
              <Text id={doughLabelId} fw={700} size="sm" mb={6}>
                {t("pos.product.dough")}
              </Text>
              <Tabs
                value={String(activeTab.valueId)}
                onChange={(value) => {
                  const tab = tabs.find((candidate) => String(candidate.valueId) === value);
                  if (tab) setVariantId(variantForDough(tab, variant).id);
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
                      value={variantId}
                      onChange={setVariantId}
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
              value={variantId}
              onChange={setVariantId}
              label={t("pos.product.chooseOption")}
              labelOf={(candidate) => pick(candidate.labelEn, candidate.labelAr) || name(product)}
            />
          ) : null}

          {product.addOns.length ? (
            <Checkbox.Group value={addOnIds.map(String)} onChange={(values) => setAddOnIds(values.map(Number))} label={t("pos.product.addOns")} labelProps={{ mb: 6, fw: 700 }}>
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
            <QuantityStepper value={quantity} onChange={setQuantity} decreaseLabel={t("pos.product.decrease")} increaseLabel={t("pos.product.increase")} size="md" />
          </Group>

          <Textarea
            label={t("pos.product.notes")}
            labelProps={{ fw: 700 }}
            placeholder={t("pos.product.notesPlaceholder")}
            value={comment}
            onChange={(event) => setComment(event.currentTarget.value)}
            maxLength={MAX_COMMENT_LENGTH}
            autosize
            minRows={2}
            maxRows={4}
          />
        </Stack>
      </div>

      <div className={classes.dialogFooter}>
        <Group justify="space-between" gap="sm">
          <div>
            <Text size="xs" c="dimmed" fw={600}>
              {t("pos.product.total")} {quantity > 1 ? `(× ${quantity})` : null}
            </Text>
            {variant ? <CurrencyText value={fromFils(linePreviewFils(variant, addOns, quantity))} fw={800} size="xl" className={classes.money} /> : null}
          </div>
          <Group gap="sm" wrap="nowrap" ms="auto">
            <Button variant="default" onClick={onCancel}>
              {t("pos.product.cancel")}
            </Button>
            <Button type="submit" size="md" disabled={!variant} data-autofocus>
              {line ? t("pos.product.update") : t("pos.product.add")}
            </Button>
          </Group>
        </Group>
      </div>
    </form>
  );
};

interface ProductModalProps {
  target: ProductEditorTarget | null;
  onSubmit: (config: LineConfig) => void;
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
