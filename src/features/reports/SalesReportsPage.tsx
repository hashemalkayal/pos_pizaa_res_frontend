import { useEffect, useState } from "react";
import { Alert, Badge, Button, Pagination, Table, Text, useMatches } from "@mantine/core";
import { DatesProvider, MonthPickerInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import { IconAlertTriangle, IconCalendarMonth, IconFileSpreadsheet, IconReportAnalytics } from "@tabler/icons-react";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { errorMessageKey, toApiError } from "@/api/errors";
import { downloadSalesReport, getSalesReport, type SalesReport } from "@/api/v2/salesReport";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { datesSettings } from "@/features/orders/datesLocale";
import { useLocalized } from "@/features/pos/hooks/useLocalized";
import { formatMoney } from "@/lib/money";
import classes from "./Reports.module.css";

/** Like the backend (sales-report.service): at most 12 months. */
const MAX_MONTHS = 12;
/** Rows per page, as the other lists (Orders, Menu). */
const PAGE_SIZE = 20;
/** The current month (YYYY-MM) of the business day in Amman: the initial range. */
const businessMonth = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Amman" }).format(new Date()).slice(0, 7);
const monthsBetween = (from: string, to: string) => (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + (Number(to.slice(5, 7)) - Number(from.slice(5, 7))) + 1;

/** Totals under the rows: products, add-ons, merchandise, then the order amounts that lead to the charged total. */
const Totals = ({ report }: { report: SalesReport }) => {
  const { t } = useTranslation();
  const { totals } = report;
  const rows: { label: string; quantity?: number; sales: string; negative?: boolean; className?: string }[] = [
    { label: t("reports.productsTotal"), quantity: totals.products.quantity, sales: totals.products.sales },
    { label: t("reports.addOnsTotal"), quantity: totals.addOns.quantity, sales: totals.addOns.sales },
    { label: t("reports.merchandise"), sales: totals.merchandise, className: classes.subtotal },
    { label: t("reports.orderDiscounts"), sales: totals.orderDiscounts, negative: true },
    { label: t("reports.deliveryFees"), sales: totals.deliveryFees },
    { label: t("reports.charged", { count: totals.orders }), sales: totals.charged, className: classes.grandTotal },
  ];
  return (
    <Table.Tfoot>
      {rows.map((row) => (
        <Table.Tr key={row.label} className={row.className ?? classes.totalRow}>
          <Table.Td colSpan={3}>{row.label}</Table.Td>
          <Table.Td ta="end" className={classes.number}>
            {row.quantity ?? ""}
          </Table.Td>
          <Table.Td ta="end" className={classes.number}>
            <bdi dir="ltr">
              {row.negative ? "−" : ""}
              {formatMoney(row.sales)}
            </bdi>
          </Table.Td>
        </Table.Tr>
      ))}
    </Table.Tfoot>
  );
};

/**
 * Sales Reports (ADMIN only, Phase 6): one table of what sold in a range of months — each product configuration
 * (product, size, dough or pasta type) and each add-on, with its quantity and sales — and one Excel export of the same
 * table. Figures from the recorded orders (cancelled ones excluded), aggregated by the backend.
 */
const SalesReportsPage = () => {
  const { t, i18n } = useTranslation();
  const { pick } = useLocalized();
  const currentMonth = businessMonth();
  const [fromMonth, setFromMonth] = useState<string | null>(currentMonth);
  const [toMonth, setToMonth] = useState<string | null>(currentMonth);
  const [page, setPage] = useState(1);
  const reversed = Boolean(fromMonth && toMonth && fromMonth > toMonth);
  const tooLong = Boolean(fromMonth && toMonth && !reversed && monthsBetween(fromMonth, toMonth) > MAX_MONTHS);
  const range = fromMonth && toMonth && !reversed && !tooLong ? { fromMonth, toMonth } : null;
  // The server sends one page of rows (and the totals of every row); the export has every row.
  const query = useQuery({
    queryKey: ["reports", "sales", range?.fromMonth, range?.toMonth, page],
    queryFn: ({ signal }) => getSalesReport({ ...range!, page, pageSize: PAGE_SIZE }, signal),
    enabled: range !== null,
    placeholderData: keepPreviousData,
  });
  const report = query.data;
  const totalPages = report?.pagination.totalPages ?? 1;
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);
  // Phones: smaller and fewer page buttons, so the pagination fits on one line.
  const compactPagination = useMatches({ base: true, sm: false });
  const changeMonth = (set: (value: string | null) => void) => (value: string | null) => {
    set(value ? value.slice(0, 7) : null);
    setPage(1);
  };
  const exportExcel = useMutation({
    mutationFn: async () => {
      const blob = await downloadSalesReport({ ...range!, lang: i18n.language === "ar" ? "ar" : "en" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `sales-report_${range!.fromMonth}_${range!.toMonth}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    },
    onError: (error) => notifications.show({ color: "red", message: t(errorMessageKey(toApiError(error))) }),
  });
  const month = (value: string | null) => (value ? `${value}-01` : null);

  return (
    <DatesProvider settings={datesSettings(i18n.language)}>
      <div className={classes.page}>
        <div className={classes.toolbar}>
          <MonthPickerInput
            className={classes.month}
            label={t("reports.fromMonth")}
            leftSection={<IconCalendarMonth size={18} aria-hidden />}
            valueFormat="MMMM YYYY"
            value={month(fromMonth)}
            onChange={changeMonth(setFromMonth)}
            maxDate={`${currentMonth}-01`}
            size="md"
          />
          <MonthPickerInput
            className={classes.month}
            label={t("reports.toMonth")}
            leftSection={<IconCalendarMonth size={18} aria-hidden />}
            valueFormat="MMMM YYYY"
            value={month(toMonth)}
            onChange={changeMonth(setToMonth)}
            maxDate={`${currentMonth}-01`}
            error={reversed ? t("reports.rangeReversed") : tooLong ? t("reports.rangeTooLarge", { months: MAX_MONTHS }) : undefined}
            size="md"
          />
          <Button
            className={classes.export}
            size="action"
            leftSection={<IconFileSpreadsheet size={18} />}
            onClick={() => exportExcel.mutate()}
            loading={exportExcel.isPending}
            disabled={!range || !report?.rows.length}
          >
            {t("reports.export")}
          </Button>
        </div>
        <Text size="sm" c="dimmed">
          {t("reports.hint")}
        </Text>

        {query.isPending && !report ? (
          range ? <LoadingState label={t("reports.loading")} /> : null
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : !report?.rows.length ? (
          <EmptyState icon={<IconReportAnalytics size={28} stroke={1.6} />} title={t("reports.empty")} />
        ) : (
          <div data-stale={query.isPlaceholderData || undefined} className={classes.content}>
            {!report.totals.reconciled ? (
              <Alert color="yellow" variant="light" icon={<IconAlertTriangle size={18} />} role="status">
                {t("reports.notReconciled")}
              </Alert>
            ) : null}
            <Text size="sm" c="dimmed" aria-live="polite">
              {t("reports.rows", { count: report.pagination.total })}
            </Text>
            <Table.ScrollContainer minWidth={640}>
              <Table striped highlightOnHover verticalSpacing="xs" className={classes.table} aria-label={t("reports.tableLabel")}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t("reports.type")}</Table.Th>
                    <Table.Th>{t("reports.name")}</Table.Th>
                    <Table.Th>{t("reports.configuration")}</Table.Th>
                    <Table.Th ta="end">{t("reports.quantity")}</Table.Th>
                    <Table.Th ta="end">{t("reports.sales")}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {report.rows.map((row) => (
                    <Table.Tr key={row.key}>
                      <Table.Td>
                        <Badge component="span" variant="light" color={row.type === "PRODUCT" ? "charcoal" : "brand"} radius="sm" tt="none">
                          {t(row.type === "PRODUCT" ? "reports.product" : "reports.addOn")}
                        </Badge>
                      </Table.Td>
                      <Table.Td className={classes.name}>{pick(row.nameEn, row.nameAr)}</Table.Td>
                      <Table.Td className={classes.configuration}>{pick(row.configurationEn, row.configurationAr) || "—"}</Table.Td>
                      <Table.Td ta="end" className={classes.number}>
                        {row.quantity}
                      </Table.Td>
                      <Table.Td ta="end" className={classes.number}>
                        <bdi dir="ltr">{formatMoney(row.sales)}</bdi>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
                <Totals report={report} />
              </Table>
            </Table.ScrollContainer>
            <Pagination
              className={classes.pagination}
              value={Math.min(page, totalPages)}
              onChange={setPage}
              total={totalPages}
              size={compactPagination ? "md" : "lg"}
              siblings={compactPagination ? 0 : 1}
              radius="md"
              getControlProps={(control) => ({ "aria-label": t(`reports.pagination.${control}`) })}
            />
          </div>
        )}
      </div>
    </DatesProvider>
  );
};

export default SalesReportsPage;
