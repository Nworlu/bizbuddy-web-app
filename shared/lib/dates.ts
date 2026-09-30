import type { LocalDate } from "./types";

export type Period = "today" | "week" | "month" | "last-month";

export const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "last-month", label: "Last Month" },
];

/** Formats a Date as YYYY-MM-DD in local time. toISOString() would use UTC and shift dates near midnight. */
export function toLocalDate(d: Date): LocalDate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function today(): LocalDate {
  return toLocalDate(new Date());
}

export function daysAgo(n: number, from = new Date()): LocalDate {
  const d = new Date(from);
  d.setDate(d.getDate() - n);
  return toLocalDate(d);
}

/** Inclusive date range. YYYY-MM-DD strings compare correctly as plain strings. */
export interface DateRange {
  start: LocalDate;
  end: LocalDate;
}

export function periodRange(period: Period, now = new Date()): DateRange {
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (period) {
    case "today":
      return { start: toLocalDate(now), end: toLocalDate(now) };
    case "week": {
      // Weeks start on Monday.
      const offset = (now.getDay() + 6) % 7;
      return { start: daysAgo(offset, now), end: toLocalDate(now) };
    }
    case "month":
      return { start: toLocalDate(new Date(y, m, 1)), end: toLocalDate(now) };
    case "last-month":
      return { start: toLocalDate(new Date(y, m - 1, 1)), end: toLocalDate(new Date(y, m, 0)) };
  }
}

export function inRange(date: LocalDate, range: DateRange): boolean {
  return date >= range.start && date <= range.end;
}

/** A preset period, or dates the user picked. */
export type PeriodChoice = Period | "custom";

/** The range between two picked dates, whichever order they were picked in. */
export function customRange(a: LocalDate, b: LocalDate): DateRange {
  return a <= b ? { start: a, end: b } : { start: b, end: a };
}
