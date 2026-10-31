import { useCallback, useEffect, useState } from "react";
import { Button, CloseButton, Pagination, SegmentedControl, Select, Stack, Text, TextInput } from "@mantine/core";
import { DatePickerInput, DatesProvider } from "@mantine/dates";
import { useDebouncedValue } from "@mantine/hooks";
import { IconCalendar, IconReceipt, IconSearch } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import type { OrderStatus, ServiceType } from "@/api/v2/orders";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { datesLocale } from "./datesLocale";
import { OrderCard } from "./OrderCard";
import { OrderDrawer } from "./OrderDrawer";
import { NO_FILTERS, useOrdersPage, type OrderFilters } from "./queries";
import classes from "./Orders.module.css";

/**
 * The Orders tab: every order, newest first, as cards (10 per page, server-side). Search by order number only;
 * filters by status, business date and order type. A card opens the order's drawer at /orders/:orderId, on the
 * same page, so the search, filters and page are kept.
 */
const OrdersPage = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { orderId } = useParams();
  const openId = orderId && /^[1-9]\d{0,9}$/.test(orderId) ? Number(orderId) : null;

  const [numberInput, setNumberInput] = useState("");
  const [orderNumber] = useDebouncedValue(numberInput, 300);
  const [filters, setFilters] = useState<Omit<OrderFilters, "orderNumber">>(NO_FILTERS);
  const [page, setPage] = useState(1);
  const query = useOrdersPage({ ...filters, orderNumber }, page);
  const data = query.data;

  // Any change of the search or a filter starts again at page 1.
  const changeFilter = (patch: Partial<Omit<OrderFilters, "orderNumber">>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  };
  const changeNumber = (value: string) => {
    setNumberInput(value.replace(/\D/g, "").slice(0, 9));
    setPage(1);
  };
  const filtered = Boolean(numberInput || filters.status || filters.businessDate || filters.service);
  const clearAll = () => {
    setNumberInput("");
    setFilters(NO_FILTERS);
    setPage(1);
  };

  // Fewer pages than before (e.g. after a cancellation elsewhere): show the last one.
  const totalPages = data?.pagination.totalPages ?? 1;
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const openOrder = useCallback((id: number) => navigate(`/orders/${id}`), [navigate]);

  return (
    <DatesProvider settings={{ locale: datesLocale(i18n.language) }}>
      <Stack gap="md">
        <div className={classes.toolbar}>
          <TextInput
            className={classes.search}
            aria-label={t("orders.searchLabel")}
            placeholder={t("orders.searchPlaceholder")}
            inputMode="numeric"
            leftSection={<IconSearch size={18} aria-hidden />}
            rightSection={numberInput ? <CloseButton aria-label={t("orders.clearSearch")} onClick={() => changeNumber("")} /> : null}
            value={numberInput}
            onChange={(event) => changeNumber(event.currentTarget.value)}
            size="md"
          />
          <Select
            className={classes.filter}
            aria-label={t("orders.status")}
            placeholder={t("orders.statusAll")}
            data={(["ACTIVE", "VOIDED"] as const).map((status) => ({ value: status, label: t(`order.status.${status}`) }))}
            value={filters.status}
            onChange={(value) => changeFilter({ status: value as OrderStatus | null })}
            clearable
            size="md"
          />
          <DatePickerInput
            className={classes.filter}
            aria-label={t("orders.date")}
            placeholder={t("orders.datePlaceholder")}
            leftSection={<IconCalendar size={18} aria-hidden />}
            valueFormat="D MMM YYYY"
            value={filters.businessDate}
            onChange={(value) => changeFilter({ businessDate: value })}
            clearable
            size="md"
          />
          <SegmentedControl
            className={classes.serviceFilter}
            aria-label={t("orders.service")}
            radius="md"
            size="md"
            data={[
              { value: "ALL", label: t("orders.serviceAll") },
              { value: "DINE_IN", label: t("orders.serviceType.DINE_IN") },
              { value: "DELIVERY", label: t("orders.serviceType.DELIVERY") },
            ]}
            value={filters.service ?? "ALL"}
            onChange={(value) => changeFilter({ service: value === "ALL" ? null : (value as ServiceType) })}
          />
          {filtered ? (
            <Button size="action-compact" variant="subtle" color="charcoal" onClick={clearAll}>
              {t("orders.clearFilters")}
            </Button>
          ) : null}
        </div>

        {query.isPending ? (
          <LoadingState label={t("orders.loading")} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : !data?.items.length ? (
          <EmptyState icon={<IconReceipt size={28} stroke={1.6} />} title={filtered ? t("orders.emptyFiltered") : t("orders.empty")}>
            {filtered ? (
              <Button size="action" variant="default" onClick={clearAll}>
                {t("orders.clearFilters")}
              </Button>
            ) : null}
          </EmptyState>
        ) : (
          <>
            <Text size="sm" c="dimmed" aria-live="polite">
              {t("orders.count", { count: data.pagination.total })}
            </Text>
            <div className={classes.grid} data-stale={query.isPlaceholderData || undefined}>
              {data.items.map((order) => (
                <OrderCard key={order.id} order={order} onOpen={openOrder} />
              ))}
            </div>
            {totalPages > 1 ? (
              <Pagination
                className={classes.pagination}
                value={Math.min(page, totalPages)}
                onChange={setPage}
                total={totalPages}
                size="lg"
                radius="md"
                getControlProps={(control) => ({ "aria-label": t(`orders.pagination.${control}`) })}
              />
            ) : null}
          </>
        )}
      </Stack>

      <OrderDrawer orderId={openId} onClose={() => navigate("/orders")} />
    </DatesProvider>
  );
};

export default OrdersPage;
