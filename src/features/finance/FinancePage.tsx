import { useState, type ReactNode } from "react";
import { Alert, Paper, Table, Text, VisuallyHidden } from "@mantine/core";
import { BarChart } from "@mantine/charts";
import { DatePickerInput, DatesProvider } from "@mantine/dates";
import { IconAlertTriangle, IconCalendar, IconScale } from "@tabler/icons-react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getFinanceOverview, type FinanceOverview } from "@/api/finance";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { CurrencyText } from "@/components/money/CurrencyText";
import { DiscoverTeaser } from "@/features/discover/DiscoverTeaser";
import { datesSettings } from "@/features/orders/datesLocale";
import { useLocalized } from "@/features/pos/hooks/useLocalized";
import { formatMoney } from "@/lib/money";
import { MAX_RANGE_DAYS, businessToday, chartHours, rangeDays, sumFigures, type HourRow } from "./financeView";
import classes from "./Finance.module.css";

type Range = [string | null, string | null];

const Section = ({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) => (
  <section className={classes.card} aria-label={title}>
    <h2 className={classes.sectionTitle}>{title}</h2>
    {hint ? (
      <Text size="xs" c="dimmed" mb="sm">
        {hint}
      </Text>
    ) : null}
    {children}
  </section>
);

const Empty = ({ children }: { children: ReactNode }) => (
  <Text size="sm" c="dimmed" py="md" ta="center">
    {children}
  </Text>
);

/** Tooltip of an hour's bar: the hour, its exact sales and its orders. */
const HourTooltip = ({ row }: { row?: HourRow }) => {
  const { t } = useTranslation();
  if (!row) return null;
  return (
    <Paper withBorder shadow="sm" radius="md" px="sm" py={6}>
      <Text size="sm" fw={700} dir="ltr">
        {row.range}
      </Text>
      <Text size="sm">
        {t("finance.sales")}: <CurrencyText value={row.sales} inherit fw={700} />
      </Text>
      <Text size="sm">
        {t("finance.orders")}: {row.orders}
      </Text>
    </Paper>
  );
};

/** Sales by hour of the day (Asia/Amman), each hour summed over every day of the range. */
const HourChart = ({ overview }: { overview: FinanceOverview }) => {
  const { t } = useTranslation();
  const { arabic } = useLocalized();
  const rows = chartHours(overview.byHour);
  if (!rows.length) return <Empty>{t("finance.noSales")}</Empty>;
  return (
    <>
      <BarChart
        h={260}
        data={rows}
        dataKey="label"
        series={[{ name: "value", color: "brand.6", label: t("finance.sales") }]}
        gridAxis="y"
        tickLine="y"
        valueFormatter={(value) => String(Math.round(value * 1000) / 1000)}
        xAxisProps={{ reversed: arabic, interval: "preserveStartEnd" }}
        yAxisProps={{ orientation: arabic ? "right" : "left", width: 48 }}
        tooltipProps={{ content: ({ payload }) => <HourTooltip row={payload?.[0]?.payload as HourRow | undefined} /> }}
        aria-hidden
      />
      <VisuallyHidden>
        <table>
          <caption>{t("finance.byHour")}</caption>
          <thead>
            <tr>
              <th>{t("finance.hour")}</th>
              <th>{t("finance.orders")}</th>
              <th>{t("finance.sales")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.hour}>
                <td>{row.range}</td>
                <td>{row.orders}</td>
                <td>
                  {formatMoney(row.sales)} {t("currency.jod")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </VisuallyHidden>
    </>
  );
};

const TopItems = ({ overview }: { overview: FinanceOverview }) => {
  const { t } = useTranslation();
  const { name, pick } = useLocalized();
  if (!overview.topItems.length) return <Empty>{t("finance.noItems")}</Empty>;
  return (
    <ol className={classes.items}>
      {overview.topItems.map((item, index) => {
        const label = pick(item.labelEn, item.labelAr);
        return (
          <li key={item.variantId} className={classes.item}>
            <span className={classes.rank} aria-hidden>
              {index + 1}
            </span>
            <span className={classes.itemName}>
              <Text size="sm" fw={700} truncate>
                {name({ nameEn: item.productNameEn, nameAr: item.productNameAr })}
              </Text>
              {label ? (
                <Text size="xs" c="dimmed" truncate>
                  {label}
                </Text>
              ) : null}
            </span>
            <span className={classes.itemFigures}>
              <Text size="sm" fw={700} className={classes.number}>
                × {item.quantity}
              </Text>
              <CurrencyText value={item.sales} size="xs" c="dimmed" className={classes.number} />
            </span>
          </li>
        );
      })}
    </ol>
  );
};

/** Every cashier with orders in the range, most sales first, and their total. */
const CashierTable = ({ overview }: { overview: FinanceOverview }) => {
  const { t } = useTranslation();
  if (!overview.cashiers.length) return <Empty>{t("finance.noCashiers")}</Empty>;
  const total = sumFigures(overview.cashiers);
  return (
    <Table.ScrollContainer minWidth={320}>
      <Table verticalSpacing="xs" className={classes.table}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t("finance.cashier")}</Table.Th>
            <Table.Th ta="end">{t("finance.orders")}</Table.Th>
            <Table.Th ta="end">{t("finance.salesJod")}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {overview.cashiers.map((row) => (
            <Table.Tr key={row.userId}>
              <Table.Td className={classes.cashier}>
                <bdi dir="ltr">{row.name ?? t("finance.unknownUser", { id: row.userId })}</bdi>
              </Table.Td>
              <Table.Td ta="end" className={classes.number}>
                {row.orders}
              </Table.Td>
              <Table.Td ta="end" className={classes.number}>
                <bdi dir="ltr">{formatMoney(row.sales)}</bdi>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
        {overview.cashiers.length > 1 ? (
          <Table.Tfoot>
            <Table.Tr className={classes.totalRow}>
              <Table.Td>{t("finance.allCashiers")}</Table.Td>
              <Table.Td ta="end" className={classes.number}>
                {total.orders}
              </Table.Td>
              <Table.Td ta="end" className={classes.number}>
                <bdi dir="ltr">{formatMoney(total.sales)}</bdi>
              </Table.Td>
            </Table.Tr>
          </Table.Tfoot>
        ) : null}
      </Table>
    </Table.ScrollContainer>
  );
};

const Figure = ({ label, children }: { label: string; children: ReactNode }) => (
  <div>
    <Text size="xs" c="dimmed" fw={600}>
      {label}
    </Text>
    <Text component="div" fw={800} fz="xl" className={classes.number}>
      {children}
    </Text>
  </div>
);

/** Orders received through the external integration (EXTERNAL orders), apart from the cashiers'. */
const Integration = ({ overview }: { overview: FinanceOverview }) => {
  const { t } = useTranslation();
  const { integration } = overview;
  const names = integration.clients.map((client) => client.name).filter(Boolean);
  return (
    <>
      <div className={classes.figures}>
        <Figure label={t("finance.orders")}>{integration.orders}</Figure>
        <Figure label={t("finance.totalSales")}>
          <CurrencyText value={integration.sales} inherit />
        </Figure>
      </div>
      {names.length ? (
        <Text size="xs" c="dimmed" mt="xs">
          <bdi dir="ltr">{names.join(", ")}</bdi>
        </Text>
      ) : null}
    </>
  );
};

/**
 * Finance overview (ADMIN only, Phase 7): the sales performance of one date range — total sales and orders, sales by
 * hour, top items, every cashier and the external integration. Every figure comes from the same eligible orders (not
 * cancelled), aggregated by the backend. Not accounting, and no export (that is Reports).
 */
const FinancePage = () => {
  const { t, i18n } = useTranslation();
  const today = businessToday();
  const [range, setRange] = useState<Range>([today, today]);
  const [from, to] = range;
  const tooLong = Boolean(from && to && rangeDays(from, to) > MAX_RANGE_DAYS);
  const query = useQuery({
    queryKey: ["finance", from, to],
    queryFn: ({ signal }) => getFinanceOverview({ from: from as string, to: to as string }, signal),
    enabled: Boolean(from && to) && !tooLong,
    placeholderData: keepPreviousData,
  });
  const overview = query.data;

  return (
    <DatesProvider settings={datesSettings(i18n.language)}>
      <div className={classes.page}>
        <div className={classes.toolbar}>
          <DatePickerInput
            type="range"
            className={classes.range}
            label={t("finance.range")}
            leftSection={<IconCalendar size={18} aria-hidden />}
            valueFormat="D MMM YYYY"
            value={range}
            onChange={(value) => setRange(value as Range)}
            allowSingleDateInRange
            maxDate={today}
            error={tooLong ? t("finance.rangeTooLarge", { days: MAX_RANGE_DAYS }) : undefined}
            size="md"
          />
          <Text size="sm" c="dimmed" className={classes.rangeHint}>
            {t("finance.rangeHint")}
          </Text>
        </div>

        {query.isPending && !overview ? (
          <LoadingState label={t("finance.loading")} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : overview ? (
          <div className={classes.content} data-stale={query.isPlaceholderData || undefined}>
            <div className={classes.summary}>
              <section className={classes.card} aria-label={t("finance.totalSales")}>
                <Figure label={t("finance.totalSales")}>
                  <CurrencyText value={overview.totals.sales} inherit />
                </Figure>
              </section>
              <section className={classes.card} aria-label={t("finance.totalOrders")}>
                <Figure label={t("finance.totalOrders")}>{overview.totals.orders}</Figure>
              </section>
            </div>

            {overview.unattributed.orders ? (
              <Alert color="yellow" variant="light" icon={<IconAlertTriangle size={18} />} role="status">
                {t("finance.unattributed", { count: overview.unattributed.orders, sales: formatMoney(overview.unattributed.sales) })}
              </Alert>
            ) : null}

            <Section title={t("finance.byHour")} hint={t("finance.byHourHint")}>
              <HourChart overview={overview} />
            </Section>

            <div className={classes.columns}>
              <Section title={t("finance.topItems")} hint={t("finance.topItemsHint")}>
                <TopItems overview={overview} />
              </Section>
              <div className={classes.stack}>
                <Section title={t("finance.cashiers")}>
                  <CashierTable overview={overview} />
                </Section>
                <Section title={t("finance.integration")} hint={t("finance.integrationHint")}>
                  <Integration overview={overview} />
                </Section>
              </div>
            </div>

            <DiscoverTeaser icon={<IconScale size={21} stroke={1.7} />} title={t("discover.teasers.finance.title")} body={t("discover.teasers.finance.body")} />
          </div>
        ) : null}
      </div>
    </DatesProvider>
  );
};

export default FinancePage;
