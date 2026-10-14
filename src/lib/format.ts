import { DEFAULT_LOCATION } from "./config";

/** Wolt returns integer prices; we assume minor units (bani/cents). */
export function formatPrice(amount: number | null | undefined, currency: string = DEFAULT_LOCATION.currency) {
  if (amount == null) return "—";
  try {
    return new Intl.NumberFormat(DEFAULT_LOCATION.locale, { style: "currency", currency }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency}`;
  }
}
