// WhatsApp wording and small decisions. Pure: tested without WhatsApp, Supabase, or an AI.

import type { Answer } from "@/features/ask/lib/answer";

export const SAVE = "save";
export const CANCEL = "cancel";

/** Save or Cancel, from a button tap or a typed reply. null for anything else (a new note). */
export function decision(input: { text?: string; buttonId?: string }): typeof SAVE | typeof CANCEL | null {
  if (input.buttonId === SAVE || input.buttonId === CANCEL) return input.buttonId;
  const word = (input.text ?? "").trim().toLowerCase().replace(/[.!]+$/, "");
  if (["yes", "y", "save", "ok", "okay", "yes save", "save am", "correct", "yep"].includes(word)) return SAVE;
  if (["no", "n", "cancel", "don't save", "dont save", "wrong", "nope"].includes(word)) return CANCEL;
  return null;
}

/** An answer from the books, as plain WhatsApp text (bold with *…*). */
export function answerToText(answer: Answer): string {
  const lines = [answer.text];
  for (const row of answer.rows ?? []) lines.push(row.value ? `• ${row.label}: ${row.value}` : `• ${row.label}`);
  if (answer.total) lines.push(`*${answer.total.label}: ${answer.total.value}*`);
  if (answer.suggestions?.length) lines.push(...answer.suggestions.map((s) => `• "${s}"`));
  return lines.join("\n");
}

/** Today in Nigeria (the server's clock is UTC), as YYYY-MM-DD and a weekday. */
export function lagosToday(now = new Date()): { today: string; weekday: string } {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const weekday = now.toLocaleDateString("en-NG", { weekday: "long", timeZone: "Africa/Lagos" });
  return { today, weekday };
}

export function notLinked(appUrl: string | undefined): string {
  return [
    "Hi! This WhatsApp number isn't linked to a BizBuddy account yet.",
    appUrl ? `Start your books at ${appUrl} and sign up with *this same phone number*.` : "Sign up in the BizBuddy app with *this same phone number*.",
    "Then message me here, like: _Sold 2 shoes to David for 85k, he paid 50k_.",
  ].join("\n\n");
}

export const HELP =
  "Tell me what happened, like:\n• _Sold 2 shoes to David for 85k, he paid 50k_\n• _Paid 4k for delivery_\n• _Musa paid 20k by transfer_\n\nOr ask: _Who owes me?_";
