import { useCallback, useMemo, useReducer, useState, type ReactNode } from "react";
import { cartReducer } from "../model/cart";
import { EMPTY_DRAFT, type OrderDraft } from "../model/orderDraft";
import { PosDraftContext, type PosDraftValue } from "./posDraftContext";

export const PosDraftProvider = ({ children }: { children: ReactNode }) => {
  const [lines, dispatch] = useReducer(cartReducer, []);
  const [draft, setDraft] = useState<OrderDraft>(EMPTY_DRAFT);

  const updateDraft = useCallback((patch: Partial<OrderDraft>) => setDraft((current) => ({ ...current, ...patch })), []);
  const updateDelivery = useCallback(
    (patch: Partial<OrderDraft["delivery"]>) => setDraft((current) => ({ ...current, delivery: { ...current.delivery, ...patch } })),
    []
  );
  const resetOrder = useCallback(() => {
    dispatch({ type: "clear" });
    setDraft(EMPTY_DRAFT);
  }, []);

  const value = useMemo<PosDraftValue>(
    () => ({ lines, dispatch, draft, updateDraft, updateDelivery, resetOrder }),
    [lines, draft, updateDraft, updateDelivery, resetOrder]
  );
  return <PosDraftContext.Provider value={value}>{children}</PosDraftContext.Provider>;
};
