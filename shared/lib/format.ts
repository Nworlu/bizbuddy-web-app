const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  currencyDisplay: "narrowSymbol",
  maximumFractionDigits: 0,
});

export function formatNaira(amount: number): string {
  return naira.format(amount);
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
