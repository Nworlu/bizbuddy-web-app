const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  currencyDisplay: "narrowSymbol",
  maximumFractionDigits: 0,
});

export function formatNaira(amount: number): string {
  return naira.format(amount);
}

/**
 * Reads an amount typed by the user as whole naira ("85000", "85,000", "₦85,000").
 * Returns null for anything else, including kobo: amounts are displayed rounded to whole
 * naira, so a stored ₦4,999.50 would show as ₦5,000 and then refuse a ₦5,000 payment.
 */
export function parseNaira(input: string): number | null {
  const cleaned = input.replace(/[₦,\s]/g, "");
  if (!/^\d+$/.test(cleaned)) return null;
  const amount = Number(cleaned);
  return Number.isSafeInteger(amount) ? amount : null;
}

export function formatDate(date: string): string {
  // Parse as local midnight; new Date("YYYY-MM-DD") would parse as UTC.
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

export function greeting(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
