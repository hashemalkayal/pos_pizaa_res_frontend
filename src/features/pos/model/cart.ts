/**
 * The in-progress cart (client state). Prices are never stored here: every total shown to the cashier comes
 * from the backend quote (POST /api/orders/quote). Limits follow the backend's order schema.
 */
export const MAX_QUANTITY = 99;
export const MAX_LINES = 50;
export const MAX_COMMENT_LENGTH = 500;

/** What the cashier chose for one line. */
export interface LineConfig {
  productId: number;
  variantId: number;
  addOnIds: number[];
  quantity: number;
  comment: string | null;
}

/** A cart line: its configuration plus a stable client key, so edits and merges act on the right line. */
export interface CartLine extends LineConfig {
  key: string;
}

let lastKey = 0;
/** Unique within the browser tab; created by the caller, so the reducer stays pure. */
export const newLineKey = () => `line-${Date.now().toString(36)}-${++lastKey}`;

const clampQuantity = (quantity: number) => Math.min(MAX_QUANTITY, Math.max(1, Math.trunc(quantity) || 1));

/** Sorted unique add-ons, trimmed comment (empty → null), quantity within 1–99. */
export const normalizeConfig = (config: LineConfig): LineConfig => ({
  productId: config.productId,
  variantId: config.variantId,
  addOnIds: [...new Set(config.addOnIds)].sort((a, b) => a - b),
  quantity: clampQuantity(config.quantity),
  comment: config.comment?.trim().slice(0, MAX_COMMENT_LENGTH) || null,
});

/** Same variant, same add-ons and same note: such lines are merged into one. */
export const sameConfiguration = (a: Omit<LineConfig, "quantity">, b: Omit<LineConfig, "quantity">) =>
  a.variantId === b.variantId &&
  a.comment === b.comment &&
  a.addOnIds.length === b.addOnIds.length &&
  a.addOnIds.every((id, index) => id === b.addOnIds[index]);

export type CartAction =
  | { type: "add"; key: string; line: LineConfig }
  /** Several lines in one state update (the product dialog's "Add all to order"), each merged like "add". */
  | { type: "addMany"; lines: { key: string; line: LineConfig }[] }
  | { type: "update"; key: string; line: LineConfig }
  | { type: "setQuantity"; key: string; quantity: number }
  | { type: "remove"; key: string }
  | { type: "clear" };

export const cartReducer = (lines: CartLine[], action: CartAction): CartLine[] => {
  switch (action.type) {
    case "add": {
      const line = normalizeConfig(action.line);
      const same = lines.find((existing) => sameConfiguration(existing, line));
      if (same) return lines.map((existing) => (existing === same ? { ...existing, quantity: clampQuantity(existing.quantity + line.quantity) } : existing));
      if (lines.length >= MAX_LINES) return lines;
      return [...lines, { ...line, key: action.key }];
    }
    case "addMany":
      return action.lines.reduce((current, { key, line }) => cartReducer(current, { type: "add", key, line }), lines);
    case "update": {
      const edited = lines.find((existing) => existing.key === action.key);
      if (!edited) return lines;
      const line = normalizeConfig(action.line);
      const same = lines.find((existing) => existing.key !== action.key && sameConfiguration(existing, line));
      // The edited line now equals another one: merge into that line and drop the edited one.
      if (same) {
        return lines
          .filter((existing) => existing.key !== action.key)
          .map((existing) => (existing === same ? { ...existing, quantity: clampQuantity(existing.quantity + line.quantity) } : existing));
      }
      return lines.map((existing) => (existing.key === action.key ? { ...line, key: existing.key } : existing));
    }
    case "setQuantity":
      return lines.map((existing) => (existing.key === action.key ? { ...existing, quantity: clampQuantity(action.quantity) } : existing));
    case "remove":
      return lines.filter((existing) => existing.key !== action.key);
    case "clear":
      return [];
  }
};

/** True when one more distinct line can be added (the backend accepts at most 50 lines). */
export const canAddLine = (lines: CartLine[], line: LineConfig) =>
  lines.length < MAX_LINES || lines.some((existing) => sameConfiguration(existing, normalizeConfig(line)));

/** True when all these configurations fit in the cart together (identical ones merge into one line). */
export const canAddLines = (lines: CartLine[], configs: LineConfig[]) => {
  let current = lines;
  for (const config of configs) {
    if (!canAddLine(current, config)) return false;
    current = cartReducer(current, { type: "add", key: "pending", line: config });
  }
  return true;
};

export const itemCount = (lines: CartLine[]) => lines.reduce((total, line) => total + line.quantity, 0);
