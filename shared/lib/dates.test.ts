import { describe, expect, it } from "vitest";
import { customRange, daysAgo, inRange, periodRange, toLocalDate } from "./dates";

// Tuesday 29 September 2026, midday local time.
const TUESDAY = new Date(2026, 8, 29, 12);

describe("toLocalDate", () => {
  it("uses the local calendar date, not UTC", () => {
    // 00:30 local is still the previous day in UTC for any zone ahead of UTC (Nigeria is UTC+1).
    expect(toLocalDate(new Date(2026, 8, 29, 0, 30))).toBe("2026-09-29");
    expect(toLocalDate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("daysAgo", () => {
  it("counts back across a month boundary", () => {
    expect(daysAgo(30, TUESDAY)).toBe("2026-08-30");
  });
});

describe("periodRange", () => {
  it("today is a single day", () => {
    expect(periodRange("today", TUESDAY)).toEqual({ start: "2026-09-29", end: "2026-09-29" });
  });

  it("this week starts on Monday", () => {
    expect(periodRange("week", TUESDAY)).toEqual({ start: "2026-09-28", end: "2026-09-29" });
  });

  it("on a Sunday, this week goes back to the Monday before", () => {
    expect(periodRange("week", new Date(2026, 8, 27, 12))).toEqual({ start: "2026-09-21", end: "2026-09-27" });
  });

  it("this month runs from the 1st to today", () => {
    expect(periodRange("month", TUESDAY)).toEqual({ start: "2026-09-01", end: "2026-09-29" });
  });

  it("last month is the whole previous month", () => {
    expect(periodRange("last-month", TUESDAY)).toEqual({ start: "2026-08-01", end: "2026-08-31" });
  });

  it("last month in January is December of the previous year", () => {
    expect(periodRange("last-month", new Date(2026, 0, 15))).toEqual({ start: "2025-12-01", end: "2025-12-31" });
  });
});

describe("inRange", () => {
  it("includes both ends", () => {
    const range = { start: "2026-09-01", end: "2026-09-29" };
    expect(inRange("2026-09-01", range)).toBe(true);
    expect(inRange("2026-09-29", range)).toBe(true);
    expect(inRange("2026-08-31", range)).toBe(false);
    expect(inRange("2026-09-30", range)).toBe(false);
  });
});

describe("customRange", () => {
  it("keeps the dates in order, whichever was picked first", () => {
    expect(customRange("2026-09-01", "2026-09-15")).toEqual({ start: "2026-09-01", end: "2026-09-15" });
    expect(customRange("2026-09-15", "2026-09-01")).toEqual({ start: "2026-09-01", end: "2026-09-15" });
  });
});
