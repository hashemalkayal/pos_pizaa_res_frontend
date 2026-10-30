import type { ReactNode } from "react";
import { Badge, Button, Card, Divider, Group, SimpleGrid, Stack, Table, Text, Title } from "@mantine/core";
import { IconArrowLeft, IconArrowRight, IconReceiptOff } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { toApiError } from "@/api/errors";
import { getOrder, type Order } from "@/api/v2/orders";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { CurrencyText } from "@/components/money/CurrencyText";
import { useLocalized } from "@/features/pos/hooks/useLocalized";

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <Stack gap={2}>
    <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
      {label}
    </Text>
    <Text component="div" size="sm" fw={600} style={{ overflowWrap: "anywhere" }}>
      {children}
    </Text>
  </Stack>
);

const OrderDetails = ({ order }: { order: Order }) => {
  const { t, i18n } = useTranslation();
  const { pick } = useLocalized();
  const delivery = Boolean(order.delivery.location || order.delivery.time || Number(order.deliveryPrice) > 0);
  const createdAt = new Intl.DateTimeFormat(i18n.language === "ar" ? "ar-JO-u-nu-latn" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Amman" }).format(new Date(order.createdAt));

  return (
    <Stack gap="lg" maw={960}>
      <Group justify="space-between" align="center" wrap="wrap">
        <Group gap="sm">
          <Title order={2}>{t("order.title", { number: order.orderNumber })}</Title>
          <Badge color={order.status === "VOIDED" ? "red" : "green"} variant="light">
            {t(`order.status.${order.status}`)}
          </Badge>
          <Badge color="charcoal" variant="outline">
            {t(`order.type.${order.type}`)}
          </Badge>
        </Group>
        <Group gap="sm">
          <Button component={Link} to="/pos" variant="default" leftSection={i18n.dir() === "rtl" ? <IconArrowRight size={16} /> : <IconArrowLeft size={16} />}>
            {t("order.back")}
          </Button>
        </Group>
      </Group>

      <Card>
        <SimpleGrid cols={{ base: 1, xs: 2, md: 3 }} spacing="lg">
          <Field label={t("order.createdAt")}>{createdAt}</Field>
          <Field label={t("order.createdBy")}>{order.createdBy.name ?? "—"}</Field>
          <Field label={t("order.service")}>{t(delivery ? "pos.service.DELIVERY" : "pos.service.DINE_IN")}</Field>
          <Field label={t("order.customer")}>
            {order.customer ? (
              <>
                {order.customer.name} · <bdi dir="ltr">{order.customer.phone}</bdi>
              </>
            ) : (
              t("order.noCustomer")
            )}
          </Field>
          <Field label={t("order.payment")}>{order.paymentMethod ? t(`pos.payment.${order.paymentMethod}`) : "—"}</Field>
          <Field label={t("order.print")}>{t(`order.printStatus.${order.kitchenPrint.status}`)}</Field>
          {delivery ? (
            <>
              <Field label={t("order.deliveryAddress")}>{order.delivery.location ?? "—"}</Field>
              <Field label={t("order.deliveryTime")}>{order.delivery.time ? <bdi dir="ltr">{order.delivery.time}</bdi> : "—"}</Field>
            </>
          ) : null}
        </SimpleGrid>
      </Card>

      <Card padding={0}>
        <Table verticalSpacing="sm" horizontalSpacing="md">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t("order.items")}</Table.Th>
              <Table.Th ta="end">{t("order.total")}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {order.items.map((line) => (
              <Table.Tr key={line.id ?? line.variantId}>
                <Table.Td>
                  <Text size="sm" fw={700}>
                    {line.quantity} × {pick(line.productNameEn, line.productNameAr)}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {[pick(line.variantLabelEn, line.variantLabelAr), ...line.addOns.map((addOn) => `+ ${pick(addOn.nameEn, addOn.nameAr)}`)].filter(Boolean).join(" · ")}
                  </Text>
                  {line.comment ? (
                    <Text size="xs" fs="italic">
                      {t("order.note")}: {line.comment}
                    </Text>
                  ) : null}
                </Table.Td>
                <Table.Td ta="end" style={{ whiteSpace: "nowrap" }}>
                  <CurrencyText value={line.lineTotal} size="sm" />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        <Divider />
        <Stack gap={6} p="md">
          <Group justify="space-between">
            <Text size="sm">{t("order.subtotal")}</Text>
            <CurrencyText value={order.subtotal} size="sm" />
          </Group>
          {Number(order.discountPercent) > 0 ? (
            <Group justify="space-between">
              <Text size="sm">{t("order.discount", { percent: order.discountPercent.replace(/\.?0+$/, "") })}</Text>
              <Text size="sm">
                − <CurrencyText value={order.discountAmount} inherit />
              </Text>
            </Group>
          ) : null}
          {delivery ? (
            <Group justify="space-between">
              <Text size="sm">{t("order.delivery")}</Text>
              <CurrencyText value={order.deliveryPrice} size="sm" />
            </Group>
          ) : null}
          <Group justify="space-between">
            <Text fw={800} size="lg">
              {t("order.total")}
            </Text>
            <CurrencyText value={order.totalAmount} fw={800} size="lg" />
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
};

/** Read-only order details (GET /api/orders/:id). The full Orders section arrives in phase 3. */
const OrderDetailsPage = () => {
  const { t } = useTranslation();
  const orderId = Number(useParams().orderId);
  const valid = Number.isInteger(orderId) && orderId > 0;
  const query = useQuery({ queryKey: ["orders", orderId], queryFn: ({ signal }) => getOrder(orderId, signal), enabled: valid });

  const notFound = !valid || (query.isError && toApiError(query.error).kind === "notFound");
  if (notFound) {
    return (
      <EmptyState icon={<IconReceiptOff size={28} stroke={1.6} />} title={t("order.notFound")}>
        <Button component={Link} to="/pos">
          {t("order.back")}
        </Button>
      </EmptyState>
    );
  }
  if (query.isPending) return <LoadingState label={t("order.loading")} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  return <OrderDetails order={query.data} />;
};

export default OrderDetailsPage;
