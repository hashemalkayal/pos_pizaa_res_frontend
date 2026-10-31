import { useState, type ReactNode } from "react";
import { Alert, Button, Drawer, Group, Modal, Stack, Text, Textarea } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconAlertTriangle, IconBan, IconPrinter, IconReceiptOff } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { errorMessageKey, toApiError, type ApiError } from "@/api/errors";
import type { Customer } from "@/api/v2/customers";
import { reprintOrder, updateOrderCustomer, voidOrder, type Order } from "@/api/v2/orders";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { CurrencyText } from "@/components/money/CurrencyText";
import { CustomerPicker } from "@/features/pos/components/CustomerPicker";
import { useLocalized } from "@/features/pos/hooks/useLocalized";
import { OrderStatusBadge } from "./OrderCard";
import { orderDateTime, useOrder } from "./queries";
import classes from "./Orders.module.css";

/** Backend codes of the drawer's actions with an Orders-specific explanation. */
const ACTION_ERRORS = new Set(["PRINT_FAILED", "ORDER_VOIDED", "ORDER_VERSION_CONFLICT", "CUSTOMER_NOT_FOUND"]);
const actionErrorKey = (error: ApiError) => (error.code && ACTION_ERRORS.has(error.code) ? `orders.errors.${error.code}` : errorMessageKey(error));

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <div>
    <Text size="xs" c="dimmed" fw={600}>
      {label}
    </Text>
    <Text component="div" size="sm" fw={600} style={{ overflowWrap: "anywhere" }}>
      {children}
    </Text>
  </div>
);

interface CancelOrderDialogProps {
  order: Order;
  opened: boolean;
  pending: boolean;
  onConfirm: (reason: string | null) => void;
  onClose: () => void;
}

/** Confirmation of a cancellation, with an optional reason (kept by the backend, not shown in the drawer). */
const CancelOrderDialog = ({ order, opened, pending, onConfirm, onClose }: CancelOrderDialogProps) => {
  const { t } = useTranslation();
  const [reason, setReason] = useState("");
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      centered
      radius="lg"
      title={t("orders.cancelTitle", { number: order.orderNumber })}
      classNames={{ title: classes.dialogTitle }}
      closeOnEscape={!pending}
      closeOnClickOutside={!pending}
      withCloseButton={!pending}
    >
      <Stack gap="md">
        <Text size="sm">{t("orders.cancelBody")}</Text>
        <Textarea
          label={t("orders.cancelReason")}
          value={reason}
          onChange={(event) => setReason(event.currentTarget.value)}
          maxLength={500}
          autosize
          minRows={2}
          maxRows={4}
          disabled={pending}
        />
        <Group justify="flex-end" gap="sm">
          <Button size="action" variant="default" onClick={onClose} disabled={pending}>
            {t("orders.cancelKeep")}
          </Button>
          <Button size="action" color="red" loading={pending} onClick={() => onConfirm(reason.trim() || null)}>
            {t("orders.cancelConfirm")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

/**
 * The saved order as it was charged (never repriced). Active orders: change or remove the linked customer
 * (saved only with "Save changes"; closing the drawer discards it), reprint, or cancel. Cancelled orders are
 * read-only; their cancellation reason and time are not shown.
 */
const OrderDetails = ({ order }: { order: Order }) => {
  const { t, i18n } = useTranslation();
  const { pick } = useLocalized();
  const queryClient = useQueryClient();
  const cancelled = order.status === "VOIDED";
  // The customer chosen here: undefined = unchanged; null = no customer.
  const [staged, setStaged] = useState<Customer | null | undefined>(undefined);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [actionError, setActionError] = useState<ApiError | null>(null);
  const shownCustomer = staged === undefined ? order.customer : staged;
  const dirty = staged !== undefined && (staged?.id ?? null) !== (order.customer?.id ?? null);

  const saved = (updated: Order) => {
    queryClient.setQueryData(["orders", order.id], updated);
    void queryClient.invalidateQueries({ queryKey: ["orders", "list"] });
    setStaged(undefined);
    setActionError(null);
  };
  const failed = (error: unknown) => {
    const apiError = toApiError(error);
    setActionError(apiError);
    // Changed meanwhile (cancelled or edited elsewhere): show the current order.
    if (apiError.code === "ORDER_VOIDED" || apiError.code === "ORDER_VERSION_CONFLICT") {
      setStaged(undefined);
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
    }
  };

  const save = useMutation({
    mutationFn: () => updateOrderCustomer(order.id, order.version, staged?.id ?? null),
    onSuccess: (updated) => {
      saved(updated);
      notifications.show({ color: "green", message: t("orders.saved") });
    },
    onError: failed,
  });
  const cancel = useMutation({
    mutationFn: (reason: string | null) => voidOrder(order.id, order.version, reason),
    onSuccess: (updated) => {
      setCancelOpen(false);
      saved(updated);
      notifications.show({ color: "green", message: t("orders.cancelled", { number: order.orderNumber }) });
    },
    onError: (error) => {
      setCancelOpen(false);
      failed(error);
    },
  });
  const reprint = useMutation({
    mutationFn: () => reprintOrder(order.id),
    onSuccess: () => {
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ["orders", order.id] });
      notifications.show({ color: "green", message: t("orders.printed") });
    },
    onError: failed,
  });
  const busy = save.isPending || cancel.isPending || reprint.isPending;

  return (
    <div className={classes.drawerLayout}>
      <div className={classes.drawerScroll}>
        <Stack gap="lg">
          {cancelled ? (
            <Alert color="gray" variant="light" icon={<IconBan size={18} />} role="status">
              {t("orders.readOnly")}
            </Alert>
          ) : null}
          {actionError ? (
            <Alert color="red" variant="light" icon={<IconAlertTriangle size={18} />} role="alert">
              {t(actionErrorKey(actionError))}
            </Alert>
          ) : null}

          <div className={classes.fields}>
            <Field label={t("order.createdAt")}>{orderDateTime(order.createdAt, i18n.language)}</Field>
            <Field label={t("order.service")}>{t(`orders.serviceType.${order.serviceType}`)}</Field>
            <Field label={t("orders.status")}>
              <OrderStatusBadge status={order.status} />
            </Field>
            <Field label={t("order.payment")}>{order.paymentMethod ? t(`pos.payment.${order.paymentMethod}`) : t("orders.noPayment")}</Field>
            {!cancelled ? <Field label={t("order.print")}>{t(`order.printStatus.${order.kitchenPrint.status}`)}</Field> : null}
          </div>

          {order.serviceType === "DELIVERY" ? (
            <div className={classes.fields}>
              <Field label={t("order.deliveryAddress")}>{order.delivery.location ?? "—"}</Field>
              <Field label={t("order.deliveryTime")}>{order.delivery.time ? <bdi dir="ltr">{order.delivery.time}</bdi> : "—"}</Field>
            </div>
          ) : null}

          <section aria-label={t("order.customer")}>
            {cancelled ? (
              <Field label={t("order.customer")}>
                {order.customer ? (
                  <>
                    {order.customer.name} · <bdi dir="ltr">{order.customer.phone}</bdi>
                  </>
                ) : (
                  t("order.noCustomer")
                )}
              </Field>
            ) : (
              <Stack gap={6}>
                {shownCustomer ? (
                  <Text size="xs" c="dimmed" fw={600}>
                    {t("order.customer")}
                  </Text>
                ) : null}
                <CustomerPicker customer={shownCustomer} onChange={setStaged} allowCreate={false} />
                <Text size="xs" c={dirty ? "orange.8" : "dimmed"} fw={dirty ? 700 : 400}>
                  {dirty ? t("orders.unsaved") : t("orders.customerHint")}
                </Text>
              </Stack>
            )}
          </section>

          <section aria-label={t("order.items")}>
            <Text size="xs" c="dimmed" fw={600} mb={6}>
              {t("order.items")}
            </Text>
            <ul className={classes.items}>
              {order.items.map((line) => {
                const meta = [pick(line.variantLabelEn, line.variantLabelAr), ...line.addOns.map((addOn) => `+ ${pick(addOn.nameEn, addOn.nameAr)}`)].filter(Boolean);
                return (
                  <li key={line.id ?? line.variantId} className={classes.item}>
                    <div className={classes.itemTop}>
                      <Text size="sm" fw={700}>
                        {line.quantity} × {pick(line.productNameEn, line.productNameAr)}
                      </Text>
                      <CurrencyText value={line.lineTotal} size="sm" fw={700} className={classes.money} />
                    </div>
                    {meta.length ? (
                      <Text size="xs" c="dimmed">
                        {meta.join(" · ")}
                      </Text>
                    ) : null}
                    {line.comment ? (
                      <Text size="xs" fs="italic">
                        {t("order.note")}: {line.comment}
                      </Text>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>

          <Stack gap={4} aria-label={t("order.total")}>
            <div className={classes.summaryRow}>
              <Text size="sm">{t("order.subtotal")}</Text>
              <CurrencyText value={order.subtotal} size="sm" className={classes.money} />
            </div>
            {Number(order.discountPercent) > 0 ? (
              <div className={classes.summaryRow}>
                <Text size="sm">{t("order.discount", { percent: order.discountPercent.replace(/\.?0+$/, "") })}</Text>
                <Text size="sm" className={classes.money}>
                  − <CurrencyText value={order.discountAmount} inherit />
                </Text>
              </div>
            ) : null}
            {order.serviceType === "DELIVERY" || Number(order.deliveryPrice) > 0 ? (
              <div className={classes.summaryRow}>
                <Text size="sm">{t("order.delivery")}</Text>
                <CurrencyText value={order.deliveryPrice} size="sm" className={classes.money} />
              </div>
            ) : null}
            <div className={`${classes.summaryRow} ${classes.summaryTotal}`}>
              <span>{t("order.total")}</span>
              <CurrencyText value={order.totalAmount} inherit className={classes.money} />
            </div>
          </Stack>
        </Stack>
      </div>

      {!cancelled ? (
        <div className={classes.drawerFooter}>
          <Button size="action" variant="default" leftSection={<IconPrinter size={16} />} loading={reprint.isPending} disabled={busy} onClick={() => reprint.mutate()}>
            {t("orders.reprint")}
          </Button>
          <Button size="action" variant="light" color="red" leftSection={<IconBan size={16} />} disabled={busy} onClick={() => setCancelOpen(true)}>
            {t("orders.cancel")}
          </Button>
          <Button size="action" className={classes.saveButton} disabled={!dirty || busy} loading={save.isPending} onClick={() => save.mutate()}>
            {t("orders.save")}
          </Button>
        </div>
      ) : null}

      {!cancelled ? (
        <CancelOrderDialog key={String(cancelOpen)} order={order} opened={cancelOpen} pending={cancel.isPending} onConfirm={(reason) => cancel.mutate(reason)} onClose={() => setCancelOpen(false)} />
      ) : null}
    </div>
  );
};

interface OrderDrawerProps {
  orderId: number | null;
  onClose: () => void;
}

/** Side drawer with one order, on the end side: right in English; Mantine mirrors it to the left in Arabic. */
export const OrderDrawer = ({ orderId, onClose }: OrderDrawerProps) => {
  const { t } = useTranslation();
  const query = useOrder(orderId);
  const order = query.data;
  const notFound = query.isError && toApiError(query.error).kind === "notFound";

  return (
    <Drawer
      opened={orderId !== null}
      onClose={onClose}
      position="right"
      size="lg"
      title={
        order ? (
          <Group gap="sm" component="span">
            {t("order.title", { number: order.orderNumber })}
            <OrderStatusBadge status={order.status} />
          </Group>
        ) : (
          t("order.loading")
        )
      }
      classNames={{ content: classes.drawerContent, body: classes.drawerBody, title: classes.dialogTitle }}
      closeButtonProps={{ "aria-label": t("orders.close") }}
    >
      {orderId === null ? null : notFound ? (
        <EmptyState icon={<IconReceiptOff size={28} stroke={1.6} />} title={t("order.notFound")} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : order ? (
        <OrderDetails key={order.id} order={order} />
      ) : (
        <LoadingState label={t("order.loading")} />
      )}
    </Drawer>
  );
};
