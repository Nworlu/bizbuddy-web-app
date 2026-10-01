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

import { DEFAULT_COUNTRY, splitE164, type Country } from "./countries";

/**
 * A mobile number as E.164 digits (no +), however it was typed. For Nigeria (dial 234), accepts
 * "0803 123 4567", "+234 803…", "2348031234567", or "8031234567". Other countries accept the
 * national part with an optional leading + and country code. Returns null for invalid input.
 */
export function normalizePhone(input: string, dialCode = DEFAULT_COUNTRY.dial): string | null {
  const digits = input.replace(/\D/g, "");
  if (!digits) return null;

  if (dialCode === "234") return normalizeNigerianPhone(digits, input);

  let national = digits;
  if (digits.startsWith(dialCode)) national = digits.slice(dialCode.length);
  else if (input.trim().startsWith("+") && digits.startsWith(dialCode)) national = digits.slice(dialCode.length);

  if (national.length < 6 || national.length > 14) return null;
  if (!/^\d+$/.test(national)) return null;
  return `${dialCode}${national}`;
}

function normalizeNigerianPhone(digits: string, raw: string): string | null {
  void raw;
  let national: string | null = null;
  if (digits.length === 11 && digits.startsWith("0")) national = digits.slice(1);
  else if (digits.length === 13 && digits.startsWith("234")) national = digits.slice(3);
  else if (digits.length === 10) national = digits;
  if (!national || !/^[789]\d{9}$/.test(national)) return null;
  return `234${national}`;
}

/** WhatsApp webhooks send the sender as E.164 digits without a leading plus. */
export function normalizeWhatsAppSender(from: string): string | null {
  const digits = from.replace(/\D/g, "");
  if (!digits || digits.length < 8 || digits.length > 15) return null;
  const nigeria = normalizeNigerianPhone(digits, from);
  if (nigeria) return nigeria;
  return splitE164(digits) ? digits : null;
}

/** The private login address for a normalized phone number: the mailbox with +<phone> added. */
export function loginEmail(normalizedPhone: string, mailbox = process.env.NEXT_PUBLIC_LOGIN_EMAIL): string {
  const [local, domain] = (mailbox ?? "").split("@");
  if (!local || !domain) throw new Error("NEXT_PUBLIC_LOGIN_EMAIL is not set");
  return `${local.split("+")[0]}+${normalizedPhone}@${domain}`;
}

/** The phone number inside a login address (owner+2348031234567@gmail.com -> 2348031234567), or null. */
export function phoneFromLoginEmail(email: string | null | undefined): string | null {
  const match = /\+(\d{10,15})@/.exec(email ?? "");
  if (!match) return null;
  const digits = match[1];
  if (digits.startsWith("234")) return normalizePhone(digits, "234");
  return digits;
}

/** Shows a normalized number in a friendly way for the shop owner. */
export function displayPhone(normalizedPhone: string): string {
  const nigeria = normalizePhone(normalizedPhone, "234");
  if (nigeria && nigeria === normalizedPhone.replace(/\D/g, "")) {
    const local = `0${nigeria.slice(3)}`;
    return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
  }
  const split = splitE164(normalizedPhone.replace(/\D/g, ""));
  if (split) return `+${split.country.dial} ${split.national}`;
  return normalizedPhone.startsWith("+") ? normalizedPhone : `+${normalizedPhone}`;
}

/** Split stored text into country + national part for the phone input. */
export function parsePhoneField(value: string, fallback: Country = DEFAULT_COUNTRY): { country: Country; national: string } {
  const trimmed = value.trim();
  if (!trimmed) return { country: fallback, national: "" };
  const digits = trimmed.replace(/\D/g, "");
  const split = splitE164(digits);
  if (split) return { country: split.country, national: split.national };
  const nigeria = normalizePhone(trimmed, "234");
  if (nigeria) return { country: DEFAULT_COUNTRY, national: nigeria.slice(3) };
  return { country: fallback, national: trimmed.replace(/^\+/, "") };
}

/** What to save in business / customer records from the phone input. */
export function formatPhoneField(national: string, country: Country): string {
  const e164 = normalizePhone(national, country.dial);
  if (!e164) return national.trim();
  if (country.dial === "234") return displayPhone(e164);
  return `+${e164}`;
}
