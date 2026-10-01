// Accounts log in with a phone number and a password.
//
// Supabase's own phone login insists on an SMS code (a paid SMS provider), so each phone number is
// turned into a private login address instead, using plus-addressing on a mailbox BizBuddy controls:
// NEXT_PUBLIC_LOGIN_EMAIL=owner@gmail.com gives 08031234567 -> owner+2348031234567@gmail.com.
// Supabase checks the domain really receives mail, and nothing is sent to it while email confirmation
// is off. If Supabase ever does send one, it reaches that mailbox, never a stranger. Shop owners only
// ever see their phone number.
//
// Changing NEXT_PUBLIC_LOGIN_EMAIL changes every login, so existing accounts would need moving.

import { countryByIso, countryForE164, DEFAULT_COUNTRY_ISO, type Country } from "./countries";

const E164_MIN = 8;
const E164_MAX = 15;

function validateNgNational(national: string): boolean {
  return /^[789]\d{9}$/.test(national);
}

function normalizeNgDigits(digits: string): string | null {
  let national: string | null = null;
  if (digits.length === 11 && digits.startsWith("0")) national = digits.slice(1);
  else if (digits.length === 13 && digits.startsWith("234")) national = digits.slice(3);
  else if (digits.length === 10) national = digits;
  if (!national || !validateNgNational(national)) return null;
  return `234${national}`;
}

/**
 * A phone number as digits only (E.164 without the plus): Nigerian mobiles as 234XXXXXXXXXX, or another
 * country when typed with + / country code. Returns null for anything invalid.
 */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  const ng = normalizeNgDigits(digits);
  if (ng) return ng;

  if (trimmed.startsWith("+")) {
    if (digits.length < E164_MIN || digits.length > E164_MAX) return null;
    return digits;
  }

  return null;
}

/** Builds E.164 digits from a country calling code and what the user typed in the national field. */
export function phoneFromParts(dialCode: string, nationalInput: string): string | null {
  let national = nationalInput.replace(/\D/g, "");
  const code = dialCode.replace(/\D/g, "");
  if (!national || !code) return null;
  if (national.startsWith("0")) national = national.slice(1);
  if (code === "234") {
    if (!validateNgNational(national)) return null;
    return `234${national}`;
  }
  const full = `${code}${national}`;
  if (full.length < E164_MIN || full.length > E164_MAX) return null;
  return full;
}

export type PhoneParts = { country: Country; national: string };

/** Splits stored phone text into country + national field for the selector UI. */
export function splitPhone(stored: string, defaultIso = DEFAULT_COUNTRY_ISO): PhoneParts {
  const trimmed = stored.trim();
  if (!trimmed) return { country: countryByIso(defaultIso), national: "" };

  const normalized = normalizePhone(trimmed);
  if (normalized) {
    const country = countryForE164(normalized) ?? countryByIso(defaultIso);
    let national = normalized.slice(country.dialCode.length);
    if (country.iso === "NG") national = `0${national}`;
    return { country, national };
  }

  const digits = trimmed.replace(/\D/g, "");
  const country = countryForE164(digits) ?? countryByIso(defaultIso);
  if (digits.startsWith(country.dialCode)) {
    let national = digits.slice(country.dialCode.length);
    if (country.iso === "NG" && !national.startsWith("0")) national = `0${national}`;
    return { country, national };
  }

  return { country: countryByIso(defaultIso), national: trimmed };
}

/** The private login address for a normalized phone number: the mailbox with +<phone> added. */
export function loginEmail(normalizedPhone: string, mailbox = process.env.NEXT_PUBLIC_LOGIN_EMAIL): string {
  const [local, domain] = (mailbox ?? "").split("@");
  if (!local || !domain) throw new Error("NEXT_PUBLIC_LOGIN_EMAIL is not set");
  return `${local.split("+")[0]}+${normalizedPhone}@${domain}`;
}

/** The phone number inside a login address (owner+2348031234567@gmail.com -> 2348031234567), or null. */
export function phoneFromLoginEmail(email: string | null | undefined): string | null {
  const match = /\+(\d{8,15})@/.exec(email ?? "");
  return match ? normalizePhone(match[1]) ?? match[1] : null;
}

/** Friendly label for showing a stored number (Nigeria keeps the local 0803 style). */
export function displayPhone(normalizedPhone: string): string {
  const digits = normalizedPhone.replace(/\D/g, "");
  if (digits.startsWith("234") && digits.length === 13) {
    const local = `0${digits.slice(3)}`;
    return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
  }
  const country = countryForE164(digits);
  if (country) return `+${country.dialCode} ${digits.slice(country.dialCode.length)}`;
  return normalizedPhone;
}
