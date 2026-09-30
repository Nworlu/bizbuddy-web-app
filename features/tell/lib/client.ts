"use client";

import { today } from "@/shared/lib/dates";
import { getSyncMeta } from "@/shared/lib/store";
import { accountsEnabled, supabase } from "@/shared/lib/supabase";
import type { BizData } from "@/shared/lib/types";
import { parseInterpretation, type Interpretation } from "./intents";

/** Tell BizBuddy reads notes with Claude on the server, so it needs an account and a connection. */
export function canTell(): boolean {
  return accountsEnabled() && getSyncMeta() !== null && (typeof navigator === "undefined" || navigator.onLine);
}

export class TellError extends Error {}

/** Sends the note to /api/tell. Only customer names go with it, to match "David" to "David Okafor"; never the books. */
export async function tellBizBuddy(message: string, data: BizData): Promise<Interpretation> {
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
  return parseInterpretation(JSON.stringify(body));
}
