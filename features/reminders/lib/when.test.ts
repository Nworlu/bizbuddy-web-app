import { describe, expect, it } from "vitest";
import { dueFrom, formatWhen, lagosClock, lagosToUtc, reminderList, snoozed } from "./when";

// Wednesday 30 Sep 2026, 14:05 in Lagos (13:05 UTC).
const NOW = new Date("2026-09-30T13:05:00Z");

describe("reminder times", () => {
  it("reads Lagos time from the UTC clock", () => {
    expect(lagosClock(NOW)).toEqual({ date: "2026-09-30", time: "14:05" });
    expect(lagosToUtc("2026-10-02", "09:00").toISOString()).toBe("2026-10-02T08:00:00.000Z");
  });

  it("works out when it's due from what was said", () => {
    expect(dueFrom({ date: null, time: null, inMinutes: 120 }, NOW)?.toISOString()).toBe("2026-09-30T15:05:00.000Z");
    expect(dueFrom({ date: "2026-10-02", time: null, inMinutes: null }, NOW)?.toISOString()).toBe("2026-10-02T08:00:00.000Z"); // 9am
    expect(dueFrom({ date: null, time: "18:00", inMinutes: null }, NOW)?.toISOString()).toBe("2026-09-30T17:00:00.000Z"); // later today
    expect(dueFrom({ date: null, time: "08:00", inMinutes: null }, NOW)?.toISOString()).toBe("2026-10-01T07:00:00.000Z"); // passed: tomorrow
  });

  it("has no time when none was said, or it's already past", () => {
    expect(dueFrom({ date: null, time: null, inMinutes: null }, NOW)).toBeNull();
    expect(dueFrom({ date: "2026-09-29", time: "10:00", inMinutes: null }, NOW)).toBeNull();
  });

  it("says when in the owner's words, and snoozes", () => {
    expect(formatWhen("2026-10-02T08:00:00Z", NOW)).toBe("Fri 2 Oct, 9:00am");
    expect(snoozed("hour", NOW).toISOString()).toBe("2026-09-30T14:05:00.000Z");
    expect(snoozed("tomorrow", NOW).toISOString()).toBe("2026-10-01T08:00:00.000Z");
  });

  it("numbers the list so one can be cancelled", () => {
    const text = reminderList([{ id: "a", text: "Collect from David", dueAt: "2026-10-02T08:00:00Z" }], NOW);
    expect(text).toContain("1. Fri 2 Oct, 9:00am: Collect from David");
    expect(reminderList([], NOW)).toContain("no reminders");
  });
});
