/** Wolt returns integer prices; we assume minor units (cents/agorot). */
export function formatPrice(amount: number | null | undefined, currency = "EUR") {
  if (amount == null) return "—";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency}`;
  }
}
