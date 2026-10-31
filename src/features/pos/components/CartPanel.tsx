import { memo } from "react";
import {
  ActionIcon,
  Button,
  Group,
  ScrollArea,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import {
  IconArmchair,
  IconChevronDown,
  IconPencil,
  IconShoppingBag,
  IconTrash,
  IconTruckDelivery,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { CurrencyText } from "@/components/money/CurrencyText";
import { EmptyState } from "@/components/feedback/EmptyState";
import { fromFils } from "@/lib/money";
import { itemCount, type CartLine } from "../model/cart";
import { selectedAddOns, type CatalogIndex } from "../model/catalogView";
import {
  MAX_LOCATION_LENGTH,
  type CheckoutProblem,
  type OrderDraft,
  type ServiceType,
} from "../model/orderDraft";
import type { CartPricing } from "../model/pricing";
import { useLocalized } from "../hooks/useLocalized";
import { CustomerPicker } from "./CustomerPicker";
import { DecimalInput } from "./DecimalInput";
import { DeliveryTimeInput } from "./DeliveryTimeInput";
import { QuantityStepper } from "./QuantityStepper";
import classes from "../Pos.module.css";

interface CartLineRowProps {
  line: CartLine;
  index: CatalogIndex | null;
  /** Line total from local pricing; null when the catalog no longer sells this line. */
  lineTotal: string | null;
  onEdit: (key: string) => void;
  onRemove: (key: string) => void;
  onQuantity: (key: string, quantity: number) => void;
}

const CartLineRow = memo(
  ({
    line,
    index,
    lineTotal,
    onEdit,
    onRemove,
    onQuantity,
  }: CartLineRowProps) => {
    const { t } = useTranslation();
    const { name, pick } = useLocalized();
    const entry = index?.variants.get(line.variantId);
    const productName = entry ? name(entry.product) : `#${line.variantId}`;
    const variantLabel = entry
      ? pick(entry.variant.labelEn, entry.variant.labelAr)
      : "";
    const addOns = entry ? selectedAddOns(entry.product, line.addOnIds) : [];
    return (
      <li className={classes.line}>
        <div className={classes.lineTop}>
          <div style={{ minWidth: 0 }}>
            <div className={classes.lineName}>{productName}</div>
            {variantLabel || addOns.length ? (
              <div className={classes.lineMeta}>
                {[variantLabel, ...addOns.map((addOn) => `+ ${name(addOn)}`)]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            ) : null}
            {line.comment ? (
              <div className={classes.lineNote}>“{line.comment}”</div>
            ) : null}
          </div>
          {lineTotal ? (
            <CurrencyText
              value={lineTotal}
              fw={700}
              size="sm"
              className={classes.money}
            />
          ) : (
            <Text size="xs" fw={700} c="red.7">
              {t("pos.cart.unavailable")}
            </Text>
          )}
        </div>
        <div className={classes.lineBottom}>
          <QuantityStepper
            value={line.quantity}
            onChange={(quantity) => onQuantity(line.key, quantity)}
            decreaseLabel={t("pos.cart.decrease", { name: productName })}
            increaseLabel={t("pos.cart.increase", { name: productName })}
            valueLabel={t("pos.cart.quantityOf", {
              quantity: line.quantity,
              name: productName,
            })}
          />
          <Group gap={2}>
            <Tooltip label={t("pos.cart.edit", { name: productName })}>
              <ActionIcon
                size="action"
                variant="subtle"
                color="charcoal"
                disabled={!lineTotal}
                onClick={() => onEdit(line.key)}
                aria-label={t("pos.cart.edit", { name: productName })}
              >
                <IconPencil size={17} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t("pos.cart.remove", { name: productName })}>
              <ActionIcon
                size="action"
                variant="subtle"
                color="red"
                onClick={() => onRemove(line.key)}
                aria-label={t("pos.cart.remove", { name: productName })}
              >
                <IconTrash size={17} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </div>
      </li>
    );
  },
);
CartLineRow.displayName = "CartLineRow";

interface CartPanelProps {
  lines: CartLine[];
  index: CatalogIndex | null;
  /** Local pricing of the cart (instant); null until the catalog is loaded. */
  pricing: CartPricing | null;
  draft: OrderDraft;
  problems: CheckoutProblem[];
  canCheckout: boolean;
  /** Narrow screens: the cart is a bottom sheet. */
  open: boolean;
  onCloseSheet: () => void;
  onEditLine: (key: string) => void;
  onRemoveLine: (key: string) => void;
  onQuantity: (key: string, quantity: number) => void;
  onClear: () => void;
  onDraft: (patch: Partial<OrderDraft>) => void;
  onDelivery: (patch: Partial<OrderDraft["delivery"]>) => void;
  onCheckout: () => void;
}

export const CartPanel = ({
  lines,
  index,
  pricing,
  draft,
  problems,
  canCheckout,
  open,
  onCloseSheet,
  onEditLine,
  onRemoveLine,
  onQuantity,
  onClear,
  onDraft,
  onDelivery,
  onCheckout,
}: CartPanelProps) => {
  const { t } = useTranslation();
  const totals = lines.length ? pricing?.totals : undefined;
  const count = itemCount(lines);

  return (
    <aside
      className={classes.cart}
      data-open={open || undefined}
      aria-label={t("pos.cart.title")}
    >
      <div className={classes.cartHeader}>
        <Group gap="xs" wrap="nowrap">
          <Title order={2} size="h4">
            {t("pos.cart.title")}
          </Title>
          {count ? (
            <Text size="sm" c="dimmed">
              {t("pos.cart.items", { count })}
            </Text>
          ) : null}
        </Group>
        <Group gap={4} wrap="nowrap">
          {lines.length ? (
            <Button
              variant="subtle"
              color="red"
              size="action-compact"
              leftSection={<IconTrash size={15} />}
              onClick={onClear}
            >
              {t("pos.cart.clear")}
            </Button>
          ) : null}
          <ActionIcon
            size="action"
            hiddenFrom="md"
            variant="subtle"
            color="charcoal"
            onClick={onCloseSheet}
            aria-label={t("pos.cart.mobileClose")}
          >
            <IconChevronDown size={20} />
          </ActionIcon>
        </Group>
      </div>

      <div className={classes.cartService}>
        <SegmentedControl
          fullWidth
          radius="md"
          aria-label={t("pos.service.label")}
          value={draft.serviceType}
          onChange={(value) => onDraft({ serviceType: value as ServiceType })}
          data={[
            {
              value: "DINE_IN",
              label: (
                <Group gap={6} justify="center" wrap="nowrap">
                  <IconArmchair size={16} aria-hidden />
                  {t("pos.service.DINE_IN")}
                </Group>
              ),
            },
            {
              value: "DELIVERY",
              label: (
                <Group gap={6} justify="center" wrap="nowrap">
                  <IconTruckDelivery size={16} aria-hidden />
                  {t("pos.service.DELIVERY")}
                </Group>
              ),
            },
          ]}
        />
      </div>

      <ScrollArea className={classes.cartScroll} type="auto" scrollbarSize={6}>
        <div className={classes.cartBody}>
          {lines.length ? (
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
              aria-label={t("pos.cart.title")}
            >
              {lines.map((line, position) => {
                const priced = pricing?.lines[position];
                return (
                  <CartLineRow
                    key={line.key}
                    line={line}
                    index={index}
                    lineTotal={priced ? fromFils(priced.lineTotalFils) : null}
                    onEdit={onEditLine}
                    onRemove={onRemoveLine}
                    onQuantity={onQuantity}
                  />
                );
              })}
            </ul>
          ) : (
            <EmptyState
              icon={<IconShoppingBag size={26} stroke={1.6} />}
              title={t("pos.cart.empty")}
              description={t("pos.cart.emptyHint")}
            />
          )}

          <section
            className={classes.details}
            aria-label={t("pos.cart.details")}
          >
            <CustomerPicker
              customer={draft.customer}
              onChange={(customer) => onDraft({ customer })}
            />

            {draft.serviceType === "DELIVERY" ? (
              <>
                <TextInput
                  label={t("pos.delivery.location")}
                  placeholder={t("pos.delivery.locationPlaceholder")}
                  withAsterisk
                  value={draft.delivery.location}
                  maxLength={MAX_LOCATION_LENGTH}
                  onChange={(event) =>
                    onDelivery({ location: event.currentTarget.value })
                  }
                />
                <Group grow align="flex-start" gap="sm">
                  <DeliveryTimeInput
                    value={draft.delivery.time}
                    onChange={(time, timeIncomplete) =>
                      onDelivery({ time, timeIncomplete })
                    }
                  />
                  <DecimalInput
                    label={t("pos.delivery.fee")}
                    description={t("pos.delivery.feeHint")}
                    withAsterisk
                    integerDigits={7}
                    fractionDigits={3}
                    placeholder="0.000"
                    value={draft.delivery.fee}
                    onChange={(fee) => onDelivery({ fee })}
                    rightSection={
                      <Text size="xs" c="dimmed">
                        {t("currency.jod")}
                      </Text>
                    }
                    rightSectionWidth={44}
                  />
                </Group>
              </>
            ) : null}

            <DecimalInput
              label={t("pos.discount.label")}
              description={t("pos.discount.hint")}
              integerDigits={3}
              fractionDigits={2}
              placeholder="0"
              value={draft.discountPercent}
              onChange={(discountPercent) => onDraft({ discountPercent })}
              rightSection={
                <Text size="sm" c="dimmed">
                  %
                </Text>
              }
              maw={180}
            />
          </section>
        </div>
      </ScrollArea>

      <div className={classes.cartFooter}>
        {totals ? (
          <Stack gap={4} aria-live="polite">
            <div className={classes.summaryRow}>
              <Text size="sm">{t("pos.summary.subtotal")}</Text>
              <CurrencyText
                value={fromFils(totals.subtotalFils)}
                size="sm"
                className={classes.money}
              />
            </div>
            {Number(totals.discountPercent) > 0 ? (
              <div className={classes.summaryRow}>
                <Text size="sm">
                  {t("pos.summary.discount", {
                    percent: totals.discountPercent.replace(/\.?0+$/, ""),
                  })}
                </Text>
                <Text size="sm" className={classes.money}>
                  − <CurrencyText value={fromFils(totals.discountFils)} inherit />
                </Text>
              </div>
            ) : null}
            {draft.serviceType === "DELIVERY" ? (
              <div className={classes.summaryRow}>
                <Text size="sm">{t("pos.summary.delivery")}</Text>
                <CurrencyText
                  value={fromFils(totals.deliveryFils)}
                  size="sm"
                  className={classes.money}
                />
              </div>
            ) : null}
            <div className={`${classes.summaryRow} ${classes.summaryTotal}`}>
              <span>{t("pos.summary.total")}</span>
              <CurrencyText
                value={fromFils(totals.totalFils)}
                inherit
                className={classes.money}
              />
            </div>
          </Stack>
        ) : null}
        {lines.length && problems.length ? (
          <Stack gap={2} role="status">
            {problems.map((problem) => (
              <Text key={problem} size="xs" c="orange.8">
                {t(`pos.problems.${problem}`)}
              </Text>
            ))}
          </Stack>
        ) : null}
        <Button
          size="action"
          fullWidth
          disabled={!canCheckout}
          onClick={onCheckout}
        >
          {/* One inline span: the button label is a flex box, which would drop the spaces around "·". */}
          <span>
            {t("pos.cart.checkout")}
            {totals && pricing?.complete ? (
              <>
                {" · "}
                <CurrencyText value={fromFils(totals.totalFils)} inherit />
              </>
            ) : null}
          </span>
        </Button>
      </div>
    </aside>
  );
};
