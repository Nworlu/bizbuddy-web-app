// Accounts log in with a Nigerian phone number and a password.
//
// Supabase's own phone login insists on an SMS code (a paid SMS provider), so each phone number is
// turned into a private login address instead, using plus-addressing on a mailbox BizBuddy controls:
// NEXT_PUBLIC_LOGIN_EMAIL=owner@gmail.com gives 08031234567 -> owner+2348031234567@gmail.com.
// Supabase checks the domain really receives mail, and nothing is sent to it while email confirmation
// is off. If Supabase ever does send one, it reaches that mailbox, never a stranger. Shop owners only
// ever see their phone number.
//
// Changing NEXT_PUBLIC_LOGIN_EMAIL changes every login, so existing accounts would need moving.

/**
 * A Nigerian mobile number as 234XXXXXXXXXX, however it was typed: "0803 123 4567", "+234 803…",
 * "2348031234567", or "8031234567". Returns null for anything else.
 */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  let national: string | null = null;
  if (digits.length === 11 && digits.startsWith("0")) national = digits.slice(1);
  else if (digits.length === 13 && digits.startsWith("234")) national = digits.slice(3);
  else if (digits.length === 10) national = digits;
  // Nigerian mobile numbers start with 7, 8, or 9 after the leading 0.
  if (!national || !/^[789]\d{9}$/.test(national)) return null;
  return `234${national}`;
}

/** The private login address for a normalized phone number: the mailbox with +<phone> added. */
export function loginEmail(normalizedPhone: string, mailbox = process.env.NEXT_PUBLIC_LOGIN_EMAIL): string {
  const [local, domain] = (mailbox ?? "").split("@");
  if (!local || !domain) throw new Error("NEXT_PUBLIC_LOGIN_EMAIL is not set");
  return `${local.split("+")[0]}+${normalizedPhone}@${domain}`;
}

/** 2348031234567 -> 0803 123 4567, for showing to the shop owner. */
export function displayPhone(normalizedPhone: string): string {
  const local = `0${normalizedPhone.slice(3)}`;
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
}
