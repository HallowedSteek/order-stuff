import { BUCHAREST } from "./config";

/** Wolt returns integer prices; we assume minor units (bani/cents). */
export function formatPrice(amount: number | null | undefined, currency: string = BUCHAREST.currency) {
  if (amount == null) return "—";
  try {
    return new Intl.NumberFormat(BUCHAREST.locale, { style: "currency", currency }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency}`;
  }
}
