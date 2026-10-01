/** Countries BizBuddy owners and customers are likely to use. Nigeria stays first (default). */
export type Country = { iso: string; name: string; dialCode: string };

export const DEFAULT_COUNTRY_ISO = "NG";

export const COUNTRIES: Country[] = [
  { iso: "NG", name: "Nigeria", dialCode: "234" },
  { iso: "GH", name: "Ghana", dialCode: "233" },
  { iso: "KE", name: "Kenya", dialCode: "254" },
  { iso: "ZA", name: "South Africa", dialCode: "27" },
  { iso: "EG", name: "Egypt", dialCode: "20" },
  { iso: "CI", name: "Côte d'Ivoire", dialCode: "225" },
  { iso: "SN", name: "Senegal", dialCode: "221" },
  { iso: "CM", name: "Cameroon", dialCode: "237" },
  { iso: "TZ", name: "Tanzania", dialCode: "255" },
  { iso: "UG", name: "Uganda", dialCode: "256" },
  { iso: "RW", name: "Rwanda", dialCode: "250" },
  { iso: "ET", name: "Ethiopia", dialCode: "251" },
  { iso: "MA", name: "Morocco", dialCode: "212" },
  { iso: "GB", name: "United Kingdom", dialCode: "44" },
  { iso: "US", name: "United States", dialCode: "1" },
  { iso: "CA", name: "Canada", dialCode: "1" },
  { iso: "IN", name: "India", dialCode: "91" },
  { iso: "AE", name: "United Arab Emirates", dialCode: "971" },
  { iso: "SA", name: "Saudi Arabia", dialCode: "966" },
  { iso: "DE", name: "Germany", dialCode: "49" },
  { iso: "FR", name: "France", dialCode: "33" },
];

const byIso = new Map(COUNTRIES.map((c) => [c.iso, c]));
const byDial = [...COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);

export function countryByIso(iso: string): Country {
  return byIso.get(iso) ?? COUNTRIES[0];
}

/** Longest matching dial code wins (e.g. 234 before 23). */
export function countryForE164(digits: string): Country | null {
  const d = digits.replace(/\D/g, "");
  for (const c of byDial) {
    if (d.startsWith(c.dialCode)) return c;
  }
  return null;
}

export function flagEmoji(iso: string): string {
  const code = iso.toUpperCase();
  if (code.length !== 2) return "";
  return String.fromCodePoint(...[...code].map((ch) => 0x1f1e6 - 65 + ch.charCodeAt(0)));
}

export function dialLabel(country: Country): string {
  return `+${country.dialCode}`;
}
