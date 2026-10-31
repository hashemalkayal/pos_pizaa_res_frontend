import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Group, Text } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { IconShoppingBag } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toApiError } from "@/api/errors";
import { createOrder, getOrder, listOrders, type PaymentMethod } from "@/api/orders";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { CurrencyText } from "@/components/money/CurrencyText";
import { useSession } from "@/features/auth/sessionContext";
import { canAddLines, itemCount, newLineKey, type LineConfig } from "./model/cart";
import { indexCatalog, mergeIndex, type CatalogIndex } from "./model/catalogView";
import { buildCreateOrderRequest, draftProblems, pricingAdjustments, type CheckoutProblem } from "./model/orderDraft";
import { priceCart, totalAmount } from "./model/pricing";
import { useCatalog } from "./hooks/queries";
import { usePosDraft } from "./state/posDraftContext";
import { CartPanel } from "./components/CartPanel";
import { PaymentModal, type PaymentRecovery } from "./components/PaymentModal";
import { ProductBrowser } from "./components/ProductBrowser";
import { ProductModal, type ProductEditorTarget } from "./components/ProductModal";
import { SuccessModal, type CompletedOrder } from "./components/SuccessModal";
import classes from "./Pos.module.css";

/** Orders of this cashier created this long ago or less are offered when a save may have been lost. */
const RECOVERY_WINDOW_MS = 10 * 60_000;

/**
 * The cashier screen: products on one side, the order on the other (a bottom sheet on narrow screens).
 * Prices shown in the cart come from the backend quote; the order is created and printed by the backend.
 */
const PosPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session } = useSession();
  const { lines, dispatch, draft, updateDraft, updateDelivery, resetOrder } = usePosDraft();

  const catalog = useCatalog();
  const index = useMemo(() => (catalog.data ? indexCatalog(catalog.data) : null), [catalog.data]);
  // Names of everything the menu offered this session, so a line the reloaded menu no longer sells still shows
  // what it is. Prices always come from the current menu (`index`).
  const [names, setNames] = useState<CatalogIndex | null>(null);
  useEffect(() => {
    if (index) setNames((previous) => mergeIndex(previous, index));
  }, [index]);
  // Every amount is computed here from the catalog, at once and without a request (model/pricing.ts). The
  // backend prices the order again at checkout and refuses a different total (PRICE_MISMATCH, D77).
  const pricing = useMemo(() => (index ? priceCart(index, lines, pricingAdjustments(draft)) : null), [index, lines, draft]);
  const problems = useMemo<CheckoutProblem[]>(
    () => [...(pricing && !pricing.complete ? (["itemUnavailable"] as const) : []), ...draftProblems(draft)],
    [pricing, draft]
  );
  const total = pricing?.complete ? totalAmount(pricing) : null;
  const canCheckout = lines.length > 0 && problems.length === 0 && total !== null;

  const searchRef = useRef<HTMLInputElement>(null);
  useHotkeys([["/", () => searchRef.current?.focus()]]);

  const [editor, setEditor] = useState<ProductEditorTarget | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [completed, setCompleted] = useState<CompletedOrder | null>(null);
  const [recovery, setRecovery] = useState<PaymentRecovery | null>(null);

  const openProduct = useCallback(
    (productId: number) => {
      const entry = index?.products.get(productId);
      if (entry) setEditor({ product: entry.product });
    },
    [index]
  );

  const editLine = useCallback(
    (key: string) => {
      const line = lines.find((candidate) => candidate.key === key);
      const entry = line && index?.products.get(line.productId);
      if (line && entry) setEditor({ product: entry.product, line });
    },
    [lines, index]
  );
  const removeLine = useCallback((key: string) => dispatch({ type: "remove", key }), [dispatch]);
  const setQuantity = useCallback((key: string, quantity: number) => dispatch({ type: "setQuantity", key, quantity }), [dispatch]);

  /** From the product dialog: one edited line, or one or more new configurations added in a single update. */
  const submitConfigs = (configs: LineConfig[]) => {
    if (editor?.line) {
      dispatch({ type: "update", key: editor.line.key, line: configs[0] });
    } else if (!canAddLines(lines, configs)) {
      notifications.show({ color: "orange", message: t("pos.product.maxLines") });
      return false;
    } else {
      dispatch({ type: "addMany", lines: configs.map((line) => ({ key: newLineKey(), line })) });
    }
    setEditor(null);
    return true;
  };

  const clearOrder = () =>
    modals.openConfirmModal({
      title: t("pos.cart.clearTitle"),
      children: <Text size="sm">{t("pos.cart.clearBody")}</Text>,
      labels: { confirm: t("pos.cart.clearConfirm"), cancel: t("pos.cart.cancel") },
      confirmProps: { color: "red", size: "action" },
      cancelProps: { size: "action" },
      centered: true,
      onConfirm: resetOrder,
    });

  // ─── Checkout ──────────────────────────────────────────────────────────────
  const creation = useMutation({ mutationFn: createOrder });
  /** Blocks a second submit before React re-renders (a double click), on top of the disabled button. */
  const inFlight = useRef(false);

  const openPayment = () => {
    if (!canCheckout) return;
    creation.reset();
    setRecovery(null);
    setPaymentOpen(true);
  };

  /** The response was lost (network/timeout): the order may exist. Offer this cashier's latest orders. */
  const checkRecentOrders = async () => {
    setRecovery({ checking: true, orders: [] });
    try {
      const page = await listOrders({ createdByUserId: session?.user.id, type: "POS", pageSize: 5 });
      const since = Date.now() - RECOVERY_WINDOW_MS;
      setRecovery({ checking: false, orders: page.items.filter((order) => Date.parse(order.createdAt) >= since) });
    } catch {
      setRecovery({ checking: false, orders: [] });
    }
  };

  const confirmPayment = async (method: PaymentMethod, receivedFils: number | null) => {
    if (inFlight.current || !canCheckout || total === null) return;
    inFlight.current = true;
    setRecovery(null);
    try {
      const order = await creation.mutateAsync(buildCreateOrderRequest(lines, draft, method, total));
      setPaymentOpen(false);
      setSheetOpen(false);
      setCompleted({ order, receivedFils });
    } catch (error) {
      const apiError = toApiError(error);
      // A price changed since the catalog was loaded: nothing was created. Reload the catalog so every amount
      // shows the current price; the cashier checks the new total and confirms again (never retried here).
      if (apiError.code === "PRICE_MISMATCH") await queryClient.invalidateQueries({ queryKey: ["catalog"] });
      else if (apiError.kind === "network" || apiError.kind === "timeout") await checkRecentOrders();
    } finally {
      inFlight.current = false;
    }
  };

  // The menu was reloaded and an item can no longer be priced: close the payment (the cart shows why).
  useEffect(() => {
    if (paymentOpen && total === null && !creation.isPending) setPaymentOpen(false);
  }, [paymentOpen, total, creation.isPending]);

  const pickRecovered = async (orderId: number) => {
    const order = await queryClient.fetchQuery({ queryKey: ["orders", orderId], queryFn: ({ signal }) => getOrder(orderId, signal) });
    setPaymentOpen(false);
    setRecovery(null);
    setCompleted({ order, receivedFils: null });
  };

  const finishOrder = () => {
    resetOrder();
    setCompleted(null);
    creation.reset();
  };
  const newOrder = () => {
    finishOrder();
    window.setTimeout(() => searchRef.current?.focus(), 0);
  };
  const viewOrder = (orderId: number) => {
    finishOrder();
    navigate(`/orders/${orderId}`);
  };

  if (catalog.isPending) return <LoadingState label={t("pos.browser.loading")} />;
  if (catalog.isError) return <ErrorState error={catalog.error} onRetry={() => void catalog.refetch()} />;

  const count = itemCount(lines);
  return (
    <>
      <div className={classes.page}>
        <ProductBrowser categories={catalog.data} onSelect={openProduct} searchRef={searchRef} />
        <CartPanel
          lines={lines}
          index={names ?? index}
          pricing={pricing}
          draft={draft}
          problems={problems}
          canCheckout={canCheckout}
          open={sheetOpen}
          onCloseSheet={() => setSheetOpen(false)}
          onEditLine={editLine}
          onRemoveLine={removeLine}
          onQuantity={setQuantity}
          onClear={clearOrder}
          onDraft={updateDraft}
          onDelivery={updateDelivery}
          onCheckout={openPayment}
        />
        <div className={classes.backdrop} data-open={sheetOpen || undefined} onClick={() => setSheetOpen(false)} aria-hidden />
        <div className={classes.mobileBar}>
          <Group gap="sm" wrap="nowrap">
            <IconShoppingBag size={22} aria-hidden />
            <div>
              <Text size="sm" fw={700}>
                {t("pos.cart.items", { count })}
              </Text>
              {total ? <CurrencyText value={total} size="sm" /> : null}
            </div>
          </Group>
          <Button size="action" onClick={() => setSheetOpen(true)}>
            {t("pos.cart.mobileOpen")}
          </Button>
        </div>
      </div>

      <ProductModal target={editor} onSubmit={submitConfigs} onClose={() => setEditor(null)} />
      <PaymentModal
        opened={paymentOpen}
        total={total}
        draft={draft}
        itemCount={count}
        submitting={creation.isPending}
        error={creation.error ? toApiError(creation.error) : null}
        recovery={recovery}
        onConfirm={(method, receivedFils) => void confirmPayment(method, receivedFils)}
        onPickRecovered={(orderId) => void pickRecovered(orderId)}
        onClose={() => setPaymentOpen(false)}
      />
      <SuccessModal completed={completed} onNewOrder={newOrder} onViewOrder={viewOrder} />
    </>
  );
};

export default PosPage;
