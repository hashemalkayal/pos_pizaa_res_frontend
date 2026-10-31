import { memo } from "react";
import { Badge } from "@mantine/core";
import { useTranslation } from "react-i18next";
import type { OrderListItem, OrderStatus } from "@/api/v2/orders";
import { CurrencyText } from "@/components/money/CurrencyText";
import { orderDateTime } from "./queries";
import classes from "./Orders.module.css";

export const OrderStatusBadge = ({ status }: { status: OrderStatus }) => {
  const { t } = useTranslation();
  return (
    <Badge color={status === "VOIDED" ? "red" : "green"} variant="light" radius="sm" tt="none">
      {t(`order.status.${status}`)}
    </Badge>
  );
};

interface OrderCardProps {
  order: OrderListItem;
  onOpen: (orderId: number) => void;
}

/** One order of the list. The whole card opens the order (no actions on the card itself). */
export const OrderCard = memo(({ order, onOpen }: OrderCardProps) => {
  const { t, i18n } = useTranslation();
  return (
    <button type="button" className={classes.card} data-cancelled={order.status === "VOIDED" || undefined} onClick={() => onOpen(order.id)}>
      <span className={classes.cardTop}>
        <span className={classes.cardNumber}>#{order.orderNumber}</span>
        <OrderStatusBadge status={order.status} />
      </span>
      <span className={classes.cardDate}>{orderDateTime(order.createdAt, i18n.language)}</span>
      <span className={classes.cardCustomer} data-empty={!order.customer || undefined}>
        {order.customer?.name ?? t("order.noCustomer")}
      </span>
      <span className={classes.cardFooter}>
        <span className={classes.cardTags}>
          <Badge color="charcoal" variant="light" radius="sm" tt="none">
            {t(`orders.serviceType.${order.serviceType}`)}
          </Badge>
          <Badge color="charcoal" variant="outline" radius="sm" tt="none">
            {order.paymentMethod ? t(`pos.payment.${order.paymentMethod}`) : t("orders.noPayment")}
          </Badge>
        </span>
        <CurrencyText value={order.totalAmount} fw={800} className={classes.cardTotal} />
      </span>
    </button>
  );
});
OrderCard.displayName = "OrderCard";
