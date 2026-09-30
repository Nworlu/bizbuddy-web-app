"use client";

import { today } from "@/shared/lib/dates";
import { getSyncMeta } from "@/shared/lib/store";
import { accountsEnabled, supabase } from "@/shared/lib/supabase";
import type { BizData } from "@/shared/lib/types";
import type { Review } from "./autosave";
import { parseInterpretation, type Draft, type Interpretation } from "./intents";
import type { AutoSave } from "./memory";

/** Tell BizBuddy reads notes on the server, so it needs an account and a connection. */
export function canTell(): boolean {
  return accountsEnabled() && getSyncMeta() !== null && (typeof navigator === "undefined" || navigator.onLine);
}

export class TellError extends Error {}

/** Sends the note to /api/tell. Only customer names go with it, to match "David" to "David Okafor"; never the books. */
export async function tellBizBuddy(message: string, data: BizData): Promise<Interpretation & { autoSave: boolean }> {
  const session = (await supabase()?.auth.getSession())?.data.session;
  if (!session) throw new TellError("Log in again to use Tell BizBuddy.");
  let response: Response;
  try {
    response = await fetch("/api/tell", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        message,
        today: today(),
        weekday: new Date().toLocaleDateString("en-NG", { weekday: "long" }),
        customers: data.customers.map((c) => c.name),
      }),
    });
  } catch {
    throw new TellError("You're offline. Record it with the + button; it's saved on this phone.");
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new TellError(body?.error ?? "BizBuddy couldn't read that just now. Try again.");
  return { ...parseInterpretation(JSON.stringify(body)), autoSave: body?.autoSave === true };
}

async function withSession<T>(run: (token: string) => Promise<T>, fallback: T): Promise<T> {
  const session = (await supabase()?.auth.getSession())?.data.session;
  if (!session) return fallback;
  return run(session.access_token).catch(() => fallback);
}

/**
 * Tells this shop's memory what the owner did with a draft: saved as read, corrected, cancelled, undone,
 * or auto-saved. A saved note is remembered. Resolves true when it's time to offer auto-save. Failure leaves the record saved.
 */
export async function rememberShop(note: string, draft: Draft | null, review: Review = "saved"): Promise<boolean> {
  if (!canTell()) return false;
  return withSession(async (token) => {
    const response = await fetch("/api/tell/learn", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ note, draft, review }),
    });
    const body = await response.json().catch(() => null);
    return body?.offer === true;
  }, false);
}

/** Whether BizBuddy saves notes without asking. null when that can't be checked (offline, no account). */
export async function getAutoSave(): Promise<AutoSave | null> {
  if (!canTell()) return null;
  return withSession(async (token) => {
    const response = await fetch("/api/tell/autosave", { headers: { authorization: `Bearer ${token}` } });
    const body = await response.json().catch(() => null);
    return response.ok && typeof body?.autoSave === "string" ? (body.autoSave as AutoSave) : null;
  }, null);
}

/** Turns auto-save on or off. Resolves false when it couldn't be changed. */
export async function setAutoSave(on: boolean): Promise<boolean> {
  if (!canTell()) return false;
  return withSession(async (token) => {
    const response = await fetch("/api/tell/autosave", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ on }),
    });
    return response.ok;
  }, false);
}
