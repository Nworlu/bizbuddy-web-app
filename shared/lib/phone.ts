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
//
// Phone numbers are Nigerian only for now (234XXXXXXXXXX).

import { countryByIso, DEFAULT_COUNTRY_ISO, type Country } from "./countries";

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
 * A Nigerian mobile number as 234XXXXXXXXXX, however it was typed: "0803 123 4567", "+234 803…",
 * "2348031234567", or "8031234567". Returns null for anything else.
 */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  return normalizeNgDigits(digits);
}

/** WhatsApp sends the sender as E.164 digits without a plus (2348031234567 for Nigeria). */
export function normalizeWhatsAppSender(from: string): string | null {
  return normalizePhone(from);
}

/** Builds 234XXXXXXXXXX from +234 and the national field (PhoneInput). */
export function phoneFromParts(dialCode: string, nationalInput: string): string | null {
  const code = dialCode.replace(/\D/g, "");
  if (code !== "234") return null;
  return normalizePhone(nationalInput);
}

export type PhoneParts = { country: Country; national: string };

/** Splits stored phone text for the Nigeria phone input. */
export function splitPhone(stored: string, defaultIso = DEFAULT_COUNTRY_ISO): PhoneParts {
  const country = countryByIso(defaultIso);
  const trimmed = stored.trim();
  if (!trimmed) return { country, national: "" };

  const normalized = normalizePhone(trimmed);
  if (normalized) {
    return { country, national: `0${normalized.slice(3)}` };
  }

  return { country, national: trimmed };
}

/** The private login address for a normalized phone number: the mailbox with +<phone> added. */
export function loginEmail(normalizedPhone: string, mailbox = process.env.NEXT_PUBLIC_LOGIN_EMAIL): string {
  const [local, domain] = (mailbox ?? "").split("@");
  if (!local || !domain) throw new Error("NEXT_PUBLIC_LOGIN_EMAIL is not set");
  return `${local.split("+")[0]}+${normalizedPhone}@${domain}`;
}

/** The phone number inside a login address (owner+2348031234567@gmail.com -> 2348031234567), or null. */
export function phoneFromLoginEmail(email: string | null | undefined): string | null {
  const match = /\+(\d{13})@/.exec(email ?? "");
  return match ? normalizePhone(match[1]) : null;
}

/** 2348031234567 -> 0803 123 4567, for showing to the shop owner. */
export function displayPhone(normalizedPhone: string): string {
  const local = `0${normalizedPhone.replace(/\D/g, "").slice(3)}`;
  if (local.length !== 11) return normalizedPhone;
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
}
