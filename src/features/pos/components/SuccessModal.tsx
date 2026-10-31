import { Alert, Button, Group, Modal, Stack, Text, Title } from "@mantine/core";
import { IconAlertTriangle, IconCircleCheck, IconPrinter } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type { Order } from "@/api/orders";
import { CurrencyText } from "@/components/money/CurrencyText";
import { fromFils, toFils } from "@/lib/money";
import classes from "../Pos.module.css";

export interface CompletedOrder {
  order: Order;
  /** Cash only: what the customer handed over, to show the change against the saved total. */
  receivedFils: number | null;
}

interface SuccessModalProps {
  completed: CompletedOrder | null;
  onNewOrder: () => void;
  onViewOrder: (orderId: number) => void;
}

/**
 * The saved order (number and total from the backend). It closes only through its two actions, so the cart is
 * never cleared before the cashier has seen the result. Printing is the backend's job; a failed print is shown,
 * and the order must not be created again.
 */
export const SuccessModal = ({ completed, onNewOrder, onViewOrder }: SuccessModalProps) => {
  const { t } = useTranslation();
  const order = completed?.order;
  const changeFils = order && completed.receivedFils !== null && order.paymentMethod === "CASH" ? completed.receivedFils - toFils(order.totalAmount) : null;

  return (
    <Modal opened={Boolean(order)} onClose={() => undefined} withCloseButton={false} closeOnEscape={false} closeOnClickOutside={false} centered radius="lg" size="sm">
      {order ? (
        <Stack align="center" gap="md" py="sm">
          <IconCircleCheck size={64} stroke={1.5} className={classes.successIcon} aria-hidden />
          <Stack align="center" gap={2}>
            <Title order={2} size="h3">
              {t("pos.success.title")}
            </Title>
            <Text fz={28} fw={800}>
              {t("pos.success.number", { number: order.orderNumber })}
            </Text>
          </Stack>
          <Stack gap={4} w="100%">
            <Group justify="space-between">
              <Text c="dimmed">{t("pos.success.total")}</Text>
              <CurrencyText value={order.totalAmount} fw={800} size="lg" className={classes.money} />
            </Group>
            {order.paymentMethod ? (
              <Group justify="space-between">
                <Text c="dimmed">{t("pos.success.method", { method: t(`pos.payment.${order.paymentMethod}`) })}</Text>
              </Group>
            ) : null}
            {changeFils !== null && changeFils > 0 ? (
              <Group justify="space-between">
                <Text fw={700} c="green.8">
                  {t("pos.success.change")}
                </Text>
                <CurrencyText value={fromFils(changeFils)} fw={800} size="lg" c="green.8" className={classes.money} />
              </Group>
            ) : null}
          </Stack>
          {order.kitchenPrint.status === "FAILED" ? (
            <Alert color="orange" variant="light" icon={<IconAlertTriangle size={18} />} w="100%" role="alert">
              {t("pos.success.printFailed")}
            </Alert>
          ) : order.kitchenPrint.status === "SENT" ? (
            <Group gap={6} c="dimmed">
              <IconPrinter size={16} aria-hidden />
              <Text size="sm">{t("pos.success.printSent")}</Text>
            </Group>
          ) : null}
          <Group grow w="100%" gap="sm">
            <Button variant="default" size="action" onClick={() => onViewOrder(order.id)}>
              {t("pos.success.viewOrder")}
            </Button>
            <Button size="action" onClick={onNewOrder} data-autofocus>
              {t("pos.success.newOrder")}
            </Button>
          </Group>
        </Stack>
      ) : null}
    </Modal>
  );
};
