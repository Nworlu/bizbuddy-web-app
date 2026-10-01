// Reminder times. Owners think in Lagos time; the database stores UTC. Nigeria is UTC+1 all year
// (no daylight saving), so the conversion is a fixed hour. Pure: tested without a clock.

const LAGOS_OFFSET_MS = 60 * 60_000;
/** A reminder for a day with no time said ("remind me Friday") goes out at 9am. */
export const DEFAULT_TIME = "09:00";

export type Reminder = { id: string; text: string; dueAt: string };

/** Now in Lagos, as YYYY-MM-DD and HH:MM. */
export function lagosClock(now: Date): { date: string; time: string } {
  const local = new Date(now.getTime() + LAGOS_OFFSET_MS).toISOString();
  return { date: local.slice(0, 10), time: local.slice(11, 16) };
}

/** A Lagos date and time as a UTC instant. */
export function lagosToUtc(date: string, time: string): Date {
  return new Date(new Date(`${date}T${time}:00Z`).getTime() - LAGOS_OFFSET_MS);
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * When a reminder is due, from what the note said: minutes from now ("in 2 hours"), or a date and/or a
 * time. A time with no date is today, or tomorrow once it has passed. null when no time was said, or
 * it's already past (then BizBuddy asks when).
 */
export function dueFrom(said: { date: string | null; time: string | null; inMinutes: number | null }, now: Date): Date | null {
  if (said.inMinutes !== null && Number.isSafeInteger(said.inMinutes) && said.inMinutes > 0) return new Date(now.getTime() + said.inMinutes * 60_000);
  const time = said.time && /^\d{2}:\d{2}$/.test(said.time) ? said.time : null;
  const date = said.date && /^\d{4}-\d{2}-\d{2}$/.test(said.date) ? said.date : null;
  if (!date && !time) return null;
  const today = lagosClock(now).date;
  let due = lagosToUtc(date ?? today, time ?? DEFAULT_TIME);
  if (!date && due <= now) due = lagosToUtc(addDays(today, 1), time!);
  return due > now ? due : null;
}

/** "Fri 2 Oct, 9:00am" (with the year only when it isn't this year). */
export function formatWhen(due: Date | string, now: Date = new Date()): string {
  const at = typeof due === "string" ? new Date(due) : due;
  const sameYear = lagosClock(at).date.slice(0, 4) === lagosClock(now).date.slice(0, 4);
  const day = at.toLocaleDateString("en-GB", { timeZone: "Africa/Lagos", weekday: "short", day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
  const time = at.toLocaleTimeString("en-US", { timeZone: "Africa/Lagos", hour: "numeric", minute: "2-digit" }).replace(" ", "").toLowerCase();
  return `${day}, ${time}`;
}

/** Snoozing a reminder: an hour from now, or 9am tomorrow (Lagos). */
export function snoozed(how: "hour" | "tomorrow", now: Date): Date {
  if (how === "hour") return new Date(now.getTime() + 60 * 60_000);
  return lagosToUtc(addDays(lagosClock(now).date, 1), DEFAULT_TIME);
}

/** The owner's upcoming reminders as a numbered WhatsApp list; "cancel reminder 2" uses these numbers. */
export function reminderList(reminders: Reminder[], now: Date): string {
  if (reminders.length === 0) return "You have no reminders coming up. Say something like _Remind me Friday at 10am to collect money from David_.";
  const lines = reminders.map((r, i) => `${i + 1}. ${formatWhen(r.dueAt, now)}: ${r.text}`);
  return ["⏰ *Your reminders:*", ...lines, "", "To remove one, send _cancel reminder 2_."].join("\n");
}
