/** Supported countries for phone numbers. Nigeria only for now; more countries later. */
export type Country = { iso: string; name: string; dialCode: string };

export const DEFAULT_COUNTRY_ISO = "NG";

export const COUNTRIES: Country[] = [{ iso: "NG", name: "Nigeria", dialCode: "234" }];

const byIso = new Map(COUNTRIES.map((c) => [c.iso, c]));

export function countryByIso(iso: string): Country {
  return byIso.get(iso) ?? COUNTRIES[0];
}

export function countryForE164(digits: string): Country | null {
  const d = digits.replace(/\D/g, "");
  if (d.startsWith("234")) return COUNTRIES[0];
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
