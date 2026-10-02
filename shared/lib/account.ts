"use client";

// Creating an account, logging in, and logging out. Log-in is a phone number and a password
// (see shared/lib/phone.ts for how the number becomes a private login name).

import { isAuthApiError, isAuthRetryableFetchError } from "@supabase/supabase-js";
import { loginEmail, normalizePhone } from "./phone";
import { getSyncMeta, joinAccount, linkShopToAccount, unlinkPhone } from "./store";
import { remoteApi, supabase } from "./supabase";

export const MIN_PASSWORD = 8;

/** A reason the shop owner can act on, from whatever Supabase or the network threw. */
export function accountErrorMessage(error: unknown, action: "create" | "login"): string {
  if (isAuthRetryableFetchError(error) || (error instanceof TypeError && /fetch/i.test(error.message)) || (typeof navigator !== "undefined" && !navigator.onLine)) {
    return action === "create" ? "You need internet to create an account. Your books stay on this phone until then." : "You need internet to log in.";
  }
  if (isAuthApiError(error)) {
    if (error.code === "user_already_exists") return "That phone number already has an account. Log in instead.";
    if (error.code === "invalid_credentials") return "That phone number and password don't match.";
    if (error.code === "weak_password") return `Choose a stronger password, at least ${MIN_PASSWORD} characters.`;
    if (error.code === "over_request_rate_limit") return "Too many tries. Wait a minute, then try again.";
    // A setup problem on BizBuddy's side (Supabase's Email sign-in is off), not something the owner can fix.
    if (error.code === "email_provider_disabled" || error.code === "signup_disabled") {
      return action === "create" ? "New accounts can't be created right now. Your books stay on this phone; try again later." : "Logging in isn't available right now. Try again later.";
    }
  }
  return "Something went wrong. Please try again.";
}

function client() {
  const sb = supabase();
  if (!sb) throw new Error("Accounts are not set up");
  return sb;
}

/**
 * Creates an account for this phone's shop and starts backing it up. The shop must already exist on the
 * phone (a new one from setup, or books kept here before accounts). Needs internet.
 */
export async function createAccount(input: { phone: string; password: string; dialCode?: string }) {
  const phone = normalizePhone(input.phone, input.dialCode);
  if (!phone) throw new Error("Invalid phone");
  const { data, error } = await client().auth.signUp({ email: loginEmail(phone), password: input.password, options: { data: { phone } } });
  if (error) throw error;
  // With email confirmation on in Supabase there's no session yet; BizBuddy needs it off (see HANDOFF.md).
  if (!data.user || !data.session) throw new Error("Account created but not signed in: turn off email confirmation in Supabase");
  linkShopToAccount({ userId: data.user.id, phone });
}

/**
 * Logs this phone into an account. A fresh phone gets the account's books on the next sync.
 * Signing back in on a phone that was already linked keeps its books and anything still waiting to send.
 */
export async function logIn(input: { phone: string; password: string; dialCode?: string }): Promise<{ hasShop: boolean }> {
  const phone = normalizePhone(input.phone, input.dialCode);
  if (!phone) throw new Error("Invalid phone");
  const current = getSyncMeta();
  if (current && current.phone !== phone) throw new Error("Another account is linked to this phone");
  const { data, error } = await client().auth.signInWithPassword({ email: loginEmail(phone), password: input.password });
  if (error) throw error;
  if (current) return { hasShop: current.businessId !== null };
  const business = await remoteApi.getBusiness();
  joinAccount({ userId: data.user.id, phone, businessId: business?.id ?? null });
  return { hasShop: business !== null };
}

/** Logs out and removes the books from this phone. The account keeps its copy. Works offline. */
export async function logOut() {
  await supabase()?.auth.signOut({ scope: "local" }).catch(() => undefined);
  unlinkPhone();
}

/**
 * Deletes the signed-in account, then removes the books from this phone.
 * Needs internet. The server deletes only this login, never a number sent from the browser.
 */
export async function deleteAccount(): Promise<void> {
  const client = supabase();
  if (!client) throw new Error("Log in first.");
  // getSession can hand back an expired token. Refresh first so the server still accepts this login.
  const refreshed = await client.auth.refreshSession().catch(() => null);
  const session = refreshed?.data.session ?? (await client.auth.getSession()).data.session;
  if (!session) throw new Error("Log in first.");
  let response: Response;
  try {
    response = await fetch("/api/account", { method: "DELETE", headers: { authorization: `Bearer ${session.access_token}` } });
  } catch {
    throw new Error("You need internet to delete the account. Your books stay until then.");
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || "Couldn't delete the account. Try again.");
  }
  await logOut();
}

/** The signed-in user's id, if the saved session is still there (it is, offline too). */
export async function sessionUserId(): Promise<string | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.user.id ?? null;
}

/**
 * Asks the server to send this account its WhatsApp welcome (once, to the account's own number).
 * Fire and forget: a missing template or no connection never gets in the way of signing up.
 */
export function sendWhatsAppWelcome(names: { ownerName: string; shopName: string }): void {
  void (async () => {
    const session = (await supabase()?.auth.getSession())?.data.session;
    if (!session) return;
    await fetch("/api/whatsapp/welcome", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(names),
    }).catch(() => undefined);
  })();
}
