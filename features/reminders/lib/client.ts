"use client";

// The browser side of /api/reminders. Needs an account and a connection; reminders go out on WhatsApp.

import { accountsEnabled, supabase } from "@/shared/lib/supabase";
import { getSyncMeta } from "@/shared/lib/store";
import type { UnsavedReminder } from "@/features/tell/lib/memory";
import type { CheckIns } from "@/features/checkins/lib/checkins";
import type { Reminder } from "./when";

export class ReminderError extends Error {}

async function call<T>(method: string, body?: unknown, query = ""): Promise<T> {
  if (!accountsEnabled() || getSyncMeta() === null) throw new ReminderError("Back up your books with an account to set reminders.");
  const session = (await supabase()?.auth.getSession())?.data.session;
  if (!session) throw new ReminderError("Log in again to use reminders.");
  let response: Response;
  try {
    response = await fetch(`/api/reminders${query}`, {
      method,
      headers: { authorization: `Bearer ${session.access_token}`, ...(body ? { "content-type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new ReminderError("You're offline. Try again when you're connected.");
  }
  const json = await response.json().catch(() => null);
  if (!response.ok) throw new ReminderError(json?.error ?? "Couldn't do that just now. Try again.");
  return json as T;
}

export const listReminders = () => call<{ reminders: Reminder[]; unsavedReminder: UnsavedReminder; checkIns: CheckIns }>("GET");
export const createReminder = (text: string, due: Date) => call<{ reminder: Reminder }>("POST", { text, due: due.toISOString() }).then((r) => r.reminder);
export const cancelReminder = (id: string) => call<{ ok: true }>("DELETE", undefined, `?id=${encodeURIComponent(id)}`);
export const setUnsavedReminder = (choice: UnsavedReminder) => call<{ unsavedReminder: UnsavedReminder }>("PATCH", { unsavedReminder: choice });
export const setCheckIns = (checkIns: CheckIns) => call<{ checkIns: CheckIns }>("PATCH", { checkIns });
