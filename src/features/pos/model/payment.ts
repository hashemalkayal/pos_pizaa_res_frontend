import { isMoneyInput, toFils } from "@/lib/money";

/**
 * Cash handling at the counter, in whole fils (exact). The backend stores the payment method only; the amount
 * received and the change are not part of the order.
 */
export interface CashState {
  /** null while the amount typed is empty or not a valid amount. */
  receivedFils: number | null;
  /** received − due; negative while the amount is insufficient. */
  changeFils: number | null;
  sufficient: boolean;
}

export const cashState = (dueFils: number, received: string): CashState => {
  const text = received.trim();
  if (!text || !isMoneyInput(text)) return { receivedFils: null, changeFils: null, sufficient: false };
  const receivedFils = toFils(text);
  return { receivedFils, changeFils: receivedFils - dueFils, sufficient: receivedFils >= dueFils };
};

/** Quick amounts for the cash keypad: the exact total, then the next whole 1 / 5 / 10 / 20 / 50 JOD above it. */
export const quickCashAmounts = (dueFils: number): number[] => {
  const amounts = [dueFils];
  for (const step of [1, 5, 10, 20, 50]) {
    const rounded = Math.ceil(dueFils / (step * 1000)) * step * 1000;
    if (rounded > dueFils && !amounts.includes(rounded)) amounts.push(rounded);
  }
  return amounts.slice(0, 5);
};
