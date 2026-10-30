import { createContext, useContext, type Dispatch } from "react";
import type { CartAction, CartLine } from "../model/cart";
import type { OrderDraft } from "../model/orderDraft";

/**
 * The order being taken at the counter: cart lines and order details. Kept above the routes, so it survives a
 * look at another section, and dropped on sign-out.
 */
export interface PosDraftValue {
  lines: CartLine[];
  dispatch: Dispatch<CartAction>;
  draft: OrderDraft;
  updateDraft: (patch: Partial<OrderDraft>) => void;
  updateDelivery: (patch: Partial<OrderDraft["delivery"]>) => void;
  /** Empties the cart and the order details (after an order is created, or when the cashier clears it). */
  resetOrder: () => void;
}

export const PosDraftContext = createContext<PosDraftValue | null>(null);

export const usePosDraft = (): PosDraftValue => {
  const value = useContext(PosDraftContext);
  if (!value) throw new Error("usePosDraft must be used inside PosDraftProvider");
  return value;
};
