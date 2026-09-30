// WhatsApp wording and small decisions. Pure: tested without WhatsApp, Supabase, or an AI.

import type { Answer } from "@/features/ask/lib/answer";

export const SAVE = "save";
export const CANCEL = "cancel";
/** When BizBuddy asked whether money a person sent was a customer paying or the team spending. */
export const SAVE_SALE = "save-sale";
export const SAVE_EXPENSE = "save-expense";

export type Choice = typeof SAVE | typeof CANCEL | typeof SAVE_SALE | typeof SAVE_EXPENSE;

/** Save, Cancel, or which reading to save, from a button tap or a typed reply. null for anything else (a new note). */
export function decision(input: { text?: string; buttonId?: string }): Choice | null {
  if (input.buttonId === SAVE || input.buttonId === CANCEL || input.buttonId === SAVE_SALE || input.buttonId === SAVE_EXPENSE) return input.buttonId;
  const word = (input.text ?? "").trim().toLowerCase().replace(/[.!]+$/, "").replace(/[’']/g, "");
  if (["yes", "y", "save", "ok", "okay", "yes save", "save am", "correct", "yep"].includes(word)) return SAVE;
  if (["no", "n", "cancel", "dont save", "wrong", "nope"].includes(word)) return CANCEL;
  if (["sale", "a sale", "its a sale", "save as sale", "customer", "na sale"].includes(word)) return SAVE_SALE;
  if (["expense", "an expense", "its an expense", "save as expense", "team", "na expense"].includes(word)) return SAVE_EXPENSE;
  return null;
}

export const UNDO = "undo";
export const AUTO_ON = "autosave-on";
export const AUTO_OFF = "autosave-off";

/** Undo the last auto-save, or turn auto-save on or off, from a button or typed words. */
export function command(input: { text?: string; buttonId?: string }): typeof UNDO | typeof AUTO_ON | typeof AUTO_OFF | null {
  if (input.buttonId === UNDO || input.buttonId === AUTO_ON || input.buttonId === AUTO_OFF) return input.buttonId;
  const word = (input.text ?? "").trim().toLowerCase().replace(/[.!]+$/, "").replace(/[-\s]+/g, " ");
  if (word === "undo" || word === "undo that" || word === "undo it") return UNDO;
  if (["auto save on", "autosave on", "turn on auto save", "start auto save"].includes(word)) return AUTO_ON;
  if (["auto save off", "autosave off", "turn off auto save", "stop auto save", "stop autosave"].includes(word)) return AUTO_OFF;
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
  "Tell me what happened in the shop, like:\n• _Sold 2 shoes to David for 85k, he paid 50k_\n• _Paid 4k for delivery_\n• _How much did I sell this month?_";
