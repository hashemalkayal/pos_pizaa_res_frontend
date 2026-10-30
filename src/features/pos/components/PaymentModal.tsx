import { useState } from "react";
import { Alert, Button, Divider, Group, Loader, Modal, Radio, Stack, Text } from "@mantine/core";
import { IconAlertTriangle, IconBuildingBank, IconCash, IconCreditCard } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type { ApiError } from "@/api/errors";
import type { OrderListItem, OrderQuote, PaymentMethod } from "@/api/v2/orders";
import { CurrencyText } from "@/components/money/CurrencyText";
import { formatMoney, fromFils, toFils } from "@/lib/money";
import type { OrderDraft } from "../model/orderDraft";
import { cashState, quickCashAmounts } from "../model/payment";
import { DecimalInput } from "./DecimalInput";
import { quoteErrorKey } from "./quoteErrors";
import classes from "../Pos.module.css";

const METHODS: { value: PaymentMethod; icon: typeof IconCash }[] = [
  { value: "CASH", icon: IconCash },
  { value: "VISA", icon: IconCreditCard },
  { value: "CLIQ", icon: IconBuildingBank },
];

/** Shown when the connection dropped while saving: the order may exist, so the cashier checks before retrying. */
export interface PaymentRecovery {
  checking: boolean;
  orders: OrderListItem[];
}

interface PaymentFormProps {
  quote: OrderQuote;
  draft: OrderDraft;
  itemCount: number;
  submitting: boolean;
  error: ApiError | null;
  recovery: PaymentRecovery | null;
  onConfirm: (method: PaymentMethod, receivedFils: number | null) => void;
  onPickRecovered: (orderId: number) => void;
  onBack: () => void;
}

const PaymentForm = ({ quote, draft, itemCount, submitting, error, recovery, onConfirm, onPickRecovered, onBack }: PaymentFormProps) => {
  const { t, i18n } = useTranslation();
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [received, setReceived] = useState("");
  const dueFils = toFils(quote.totalAmount);
  const cash = cashState(dueFils, received);
  const canConfirm = !submitting && (method !== "CASH" || cash.sufficient);
  const time = (iso: string) => new Intl.DateTimeFormat(i18n.language === "ar" ? "ar-JO-u-nu-latn" : "en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Amman" }).format(new Date(iso));

  return (
    <form
      className={classes.dialogForm}
      onSubmit={(event) => {
        event.preventDefault();
        if (canConfirm && !recovery) onConfirm(method, method === "CASH" ? cash.receivedFils : null);
      }}
    >
      <Stack gap="md" className={classes.dialogScroll}>
        <Stack gap={6}>
          <Group justify="space-between">
            <Text size="sm" c="dimmed">{t("pos.payment.orderType")}</Text>
            <Text size="sm" fw={600}>{t(`pos.service.${draft.serviceType}`)}</Text>
          </Group>
          <Group justify="space-between">
            <Text size="sm" c="dimmed">{t("pos.payment.items")}</Text>
            <Text size="sm" fw={600}>{t("pos.cart.items", { count: itemCount })}</Text>
          </Group>
          {draft.customer ? (
            <Group justify="space-between" wrap="nowrap">
              <Text size="sm" c="dimmed">{t("pos.payment.customer")}</Text>
              <Text size="sm" fw={600} truncate>{draft.customer.name}</Text>
            </Group>
          ) : null}
          {draft.serviceType === "DELIVERY" && draft.delivery.location.trim() ? (
            <Group justify="space-between" wrap="nowrap" align="flex-start">
              <Text size="sm" c="dimmed" style={{ flexShrink: 0 }}>{t("pos.payment.deliveryTo")}</Text>
              <Text size="sm" fw={600} ta="end" style={{ overflowWrap: "anywhere" }}>{draft.delivery.location.trim()}</Text>
            </Group>
          ) : null}
          <Divider my={4} />
          <Group justify="space-between" align="baseline">
            <Text fw={700}>{t("pos.payment.total")}</Text>
            <CurrencyText value={quote.totalAmount} fw={800} fz={28} className={classes.money} />
          </Group>
        </Stack>

        <Radio.Group value={method} onChange={(value) => setMethod(value as PaymentMethod)} label={t("pos.payment.method")} labelProps={{ mb: 8, fw: 700 }}>
          <div className={classes.paymentMethods}>
            {METHODS.map(({ value, icon: Icon }) => (
              <Radio.Card key={value} value={value} className={classes.methodCard} radius="md" disabled={submitting}>
                <Icon size={26} stroke={1.6} aria-hidden />
                {t(`pos.payment.${value}`)}
              </Radio.Card>
            ))}
          </div>
        </Radio.Group>

        {method === "CASH" ? (
          <Stack gap="sm">
            <DecimalInput
              label={t("pos.payment.received")}
              integerDigits={7}
              fractionDigits={3}
              placeholder={fromFils(dueFils)}
              value={received}
              onChange={setReceived}
              size="lg"
              data-autofocus
              disabled={submitting}
              rightSection={<Text size="sm" c="dimmed">{t("currency.jod")}</Text>}
              rightSectionWidth={52}
              error={cash.receivedFils !== null && !cash.sufficient ? t("pos.payment.insufficient") : null}
            />
            <Group gap="xs">
              {quickCashAmounts(dueFils).map((amount, position) => (
                <Button key={amount} variant="default" size="action-compact" disabled={submitting} onClick={() => setReceived(fromFils(amount))}>
                  {position === 0 ? t("pos.payment.exact") : <bdi dir="ltr">{fromFils(amount)}</bdi>}
                </Button>
              ))}
            </Group>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">{t("pos.payment.due")}</Text>
              <CurrencyText value={quote.totalAmount} size="sm" className={classes.money} />
            </Group>
            {cash.changeFils !== null ? (
              <Group justify="space-between">
                <Text fw={700} c={cash.sufficient ? "green.8" : "red.7"}>
                  {cash.sufficient ? t("pos.payment.change") : t("pos.payment.stillDue")}
                </Text>
                <CurrencyText value={fromFils(Math.abs(cash.changeFils))} fw={800} size="lg" c={cash.sufficient ? "green.8" : "red.7"} className={classes.money} />
              </Group>
            ) : null}
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">{method === "VISA" ? t("pos.payment.cardHint") : t("pos.payment.cliqHint")}</Text>
        )}

        {error && !recovery ? (
          <Alert color="red" variant="light" icon={<IconAlertTriangle size={18} />} role="alert">
            {t(quoteErrorKey(error))}
            {error.requestId ? <Text size="xs" mt={4}>{t("errors.reference", { id: error.requestId })}</Text> : null}
          </Alert>
        ) : null}

        {recovery ? (
          <Alert color="orange" variant="light" icon={<IconAlertTriangle size={18} />} title={t("pos.payment.recoveryTitle")} role="alert">
            <Stack gap="xs">
              <Text size="sm">{t("pos.payment.recoveryBody")}</Text>
              {recovery.checking ? (
                <Loader size="sm" />
              ) : recovery.orders.length ? (
                recovery.orders.map((order) => (
                  <Group key={order.id} justify="space-between" wrap="nowrap">
                    <Text size="sm">
                      {t("pos.payment.recoveryOrder", { number: order.orderNumber, amount: `${formatMoney(order.totalAmount)} ${t("currency.jod")}`, time: time(order.createdAt) })}
                    </Text>
                    <Button size="action-compact" variant="white" color="orange" onClick={() => onPickRecovered(order.id)}>
                      {t("pos.payment.recoveryThisOne")}
                    </Button>
                  </Group>
                ))
              ) : (
                <Text size="sm" fw={600}>{t("pos.payment.recoveryNone")}</Text>
              )}
            </Stack>
          </Alert>
        ) : null}
      </Stack>

      <Group justify="space-between" gap="sm" className={classes.dialogFooter}>
        <Button size="action" variant="default" onClick={onBack} disabled={submitting}>
          {t("pos.payment.back")}
        </Button>
        {recovery ? (
          <Button size="action" color="orange" disabled={recovery.checking || submitting} loading={submitting} onClick={() => onConfirm(method, method === "CASH" ? cash.receivedFils : null)}>
            {t("pos.payment.retry")}
          </Button>
        ) : (
          <Button type="submit" size="action" disabled={!canConfirm} loading={submitting}>
            {submitting ? (
              t("pos.payment.saving")
            ) : (
              <span>
                {t("pos.payment.confirm")} · <CurrencyText value={quote.totalAmount} inherit />
              </span>
            )}
          </Button>
        )}
      </Group>
    </form>
  );
};

interface PaymentModalProps extends Omit<PaymentFormProps, "quote" | "onBack"> {
  opened: boolean;
  quote: OrderQuote | null;
  onClose: () => void;
}

export const PaymentModal = ({ opened, quote, submitting, onClose, ...form }: PaymentModalProps) => {
  const { t } = useTranslation();
  return (
    <Modal
      opened={opened && quote !== null}
      onClose={onClose}
      centered
      size="md"
      radius="lg"
      title={t("pos.payment.title")}
      classNames={{ content: classes.dialogContent, body: classes.dialogBody, title: classes.dialogTitle }}
      closeOnEscape={!submitting}
      closeOnClickOutside={!submitting}
      withCloseButton={!submitting}
    >
      {opened && quote ? <PaymentForm quote={quote} submitting={submitting} onBack={onClose} {...form} /> : null}
    </Modal>
  );
};
