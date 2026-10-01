// WhatsApp wording and small decisions. Pure: tested without WhatsApp, Supabase, or an AI.

import type { Answer } from "@/features/ask/lib/answer";
import type { UnsavedReminder } from "@/features/tell/lib/memory";

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

/** Buttons on reminders. The reminder's id follows the colon. */
export const REMINDER_BUTTON = { cancel: "reminder-cancel", done: "reminder-done", hour: "reminder-hour", tomorrow: "reminder-tomorrow" } as const;
export const reminderButtonId = (action: keyof typeof REMINDER_BUTTON, id: string) => `${REMINDER_BUTTON[action]}:${id}`;

export type ReminderCommand =
  | { kind: "list" }
  | { kind: "cancel-number"; number: number }
  | { kind: "button"; action: keyof typeof REMINDER_BUTTON; id: string }
  | { kind: "unsaved"; choice: UnsavedReminder }
  | { kind: "check-ins"; on: boolean };

/** Listing or cancelling reminders, a reminder's buttons, or when to be reminded about unsaved notes. */
export function reminderCommand(input: { text?: string; buttonId?: string }): ReminderCommand | null {
  if (input.buttonId) {
    const [prefix, id] = input.buttonId.split(":");
    const action = (Object.keys(REMINDER_BUTTON) as (keyof typeof REMINDER_BUTTON)[]).find((key) => REMINDER_BUTTON[key] === prefix);
    return action && id ? { kind: "button", action, id } : null;
  }
  const word = (input.text ?? "").trim().toLowerCase().replace(/[.!?]+$/, "").replace(/[’']/g, "").replace(/\s+/g, " ");
  if (["my reminders", "reminders", "show reminders", "show my reminders", "list reminders", "list my reminders"].includes(word)) return { kind: "list" };
  const cancel = /^(?:cancel|delete|remove) reminder (\d{1,2})$/.exec(word);
  if (cancel) return { kind: "cancel-number", number: Number(cancel[1]) };
  if (["stop check ins", "stop checkins", "stop check-ins", "no more check ins", "turn off check ins"].includes(word.replace(/-/g, " ").replace(/\s+/g, " ")) || word === "stop checking in") return { kind: "check-ins", on: false };
  if (["start check ins", "start checkins", "turn on check ins"].includes(word.replace(/-/g, " ").replace(/\s+/g, " "))) return { kind: "check-ins", on: true };
  if (word === "stop reminding me" || word === "dont remind me") return { kind: "unsaved", choice: "never" };
  if (/\b(unsaved|not saved)\b/.test(word)) {
    if (/\b(never|stop|dont|no more)\b/.test(word)) return { kind: "unsaved", choice: "never" };
    if (/\b(2|two) ?h(ou)?rs?\b/.test(word)) return { kind: "unsaved", choice: "2h" };
    if (/\b(30|thirty) ?min(ute)?s?\b/.test(word)) return { kind: "unsaved", choice: "30m" };
  }
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

export const HELP = "Tell me what happened, the way you'd say it. Like sold 2 shoes to David for 85k, he paid 50k. Or ask how the day went.";
