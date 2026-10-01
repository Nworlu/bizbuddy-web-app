// Check-ins BizBuddy starts by itself: at 7pm on a day with nothing recorded, "How was business today?";
// on Sunday evening, the week's numbers from the books. On for everyone, switched off per kind in
// Settings or with "stop check-ins". Pure: the scheduler (app/api/whatsapp/remind) does the sending.

import { customersOwing, periodSummary } from "@/shared/lib/finance";
import { formatNaira } from "@/shared/lib/format";
import type { BizData } from "@/shared/lib/types";

export type CheckInKind = "evening" | "weekly";
export type CheckIns = Record<CheckInKind, boolean>;
export const DEFAULT_CHECK_INS: CheckIns = { evening: true, weekly: true };

/** Sent between these Lagos times; the scheduler runs every few minutes, so the first run after 7pm sends it. */
const FROM = "19:00";
const UNTIL = "21:30";

/** 0 = Sunday … 6 = Saturday, for a Lagos date. */
export function weekdayOf(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whether this kind of check-in is due now (Lagos clock). Each is claimed once per day by the scheduler. */
export function checkInDue(kind: CheckInKind, clock: { date: string; time: string }): boolean {
  if (clock.time < FROM || clock.time > UNTIL) return false;
  return kind === "evening" || weekdayOf(clock.date) === 0;
}

/** Anything recorded for, or on, this day: then the evening nudge isn't needed. */
export function recordedOn(data: BizData, date: string): boolean {
  const on = (record: { date?: string; createdAt: string }) => record.date === date || record.createdAt.slice(0, 10) === date;
  return data.sales.some(on) || data.expenses.some(on) || data.payments.some(on);
}

export function eveningText(ownerName: string): string {
  const first = ownerName.trim().split(/\s+/)[0] || "there";
  return `Good evening ${first} 👋 How was business today?\n\nTell me anything you sold, spent, or collected, like _Sold 2 shoes to David for 85k_, and I'll put it in your books.`;
}

/** The week so far (Monday to today, Lagos dates) from the books, for Sunday's summary. */
export function weeklySummary(data: BizData, today: string): { text: string; params: string[] } {
  const start = addDays(today, -((weekdayOf(today) + 6) % 7));
  const week = periodSummary(data, { start, end: today });
  const owing = customersOwing(data);
  const owed = owing.reduce((total, row) => total + row.balance, 0);
  const shop = data.business?.name ?? "your shop";
  const top = owing.slice(0, 3).map((row) => `• ${row.customer.name}: ${formatNaira(row.balance)}`);
  const text = [
    `📊 *Your week at ${shop}*`,
    `Sales: ${formatNaira(week.sales)}`,
    `Money collected: ${formatNaira(week.collected)}`,
    `Spent: ${formatNaira(week.expenses)}`,
    "",
    owed > 0 ? `Customers owe you ${formatNaira(owed)} in total:` : "No one owes you money. 🎉",
    ...top,
    "",
    "Reply with anything I missed and I'll add it.",
  ].join("\n");
  return { text, params: [shop, formatNaira(week.sales), formatNaira(week.collected), formatNaira(week.expenses), formatNaira(owed)] };
}
