/** Countries BizBuddy shop owners and customers are likely to use. Dial codes are digits only (no +). */

export type Country = {
  iso: string;
  name: string;
  dial: string;
  flag: string;
  /** Example national number without country code (for placeholders). */
  example: string;
};

export const COUNTRIES: Country[] = [
  { iso: "NG", name: "Nigeria", dial: "234", flag: "🇳🇬", example: "803 123 4567" },
  { iso: "GH", name: "Ghana", dial: "233", flag: "🇬🇭", example: "24 123 4567" },
  { iso: "KE", name: "Kenya", dial: "254", flag: "🇰🇪", example: "712 345678" },
  { iso: "ZA", name: "South Africa", dial: "27", flag: "🇿🇦", example: "82 123 4567" },
  { iso: "GB", name: "United Kingdom", dial: "44", flag: "🇬🇧", example: "7700 900123" },
  { iso: "US", name: "United States", dial: "1", flag: "🇺🇸", example: "202 555 0123" },
  { iso: "CA", name: "Canada", dial: "1", flag: "🇨🇦", example: "416 555 0123" },
  { iso: "IN", name: "India", dial: "91", flag: "🇮🇳", example: "98765 43210" },
  { iso: "AE", name: "United Arab Emirates", dial: "971", flag: "🇦🇪", example: "50 123 4567" },
  { iso: "FR", name: "France", dial: "33", flag: "🇫🇷", example: "6 12 34 56 78" },
  { iso: "DE", name: "Germany", dial: "49", flag: "🇩🇪", example: "151 23456789" },
];

export const DEFAULT_COUNTRY = COUNTRIES[0];

export function countryByIso(iso: string): Country {
  return COUNTRIES.find((c) => c.iso === iso) ?? DEFAULT_COUNTRY;
}

export function countryByDial(dial: string): Country | undefined {
  return [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length).find((c) => dial.startsWith(c.dial) || c.dial === dial);
}

/** Longest matching dial prefix on an E.164 digit string (no +). */
export function splitE164(digits: string): { country: Country; national: string } | null {
  const clean = digits.replace(/\D/g, "");
  if (!clean) return null;
  const sorted = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  for (const country of sorted) {
    if (clean.startsWith(country.dial) && clean.length > country.dial.length + 5) {
      return { country, national: clean.slice(country.dial.length) };
    }
  }
  return null;
}
