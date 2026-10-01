import { describe, expect, it } from "vitest";
import { demoData } from "@/shared/lib/demo";
import { checkInDue, eveningText, recordedOn, weekdayOf, weeklySummary } from "./checkins";

describe("check-ins", () => {
  it("are due in the evening; the weekly one only on Sunday", () => {
    expect(weekdayOf("2026-10-04")).toBe(0);
    expect(checkInDue("evening", { date: "2026-09-30", time: "19:05" })).toBe(true);
    expect(checkInDue("evening", { date: "2026-09-30", time: "18:55" })).toBe(false);
    expect(checkInDue("evening", { date: "2026-09-30", time: "22:00" })).toBe(false);
    expect(checkInDue("weekly", { date: "2026-09-30", time: "19:05" })).toBe(false);
    expect(checkInDue("weekly", { date: "2026-10-04", time: "19:05" })).toBe(true);
  });

  it("skip the evening nudge when something was recorded that day", () => {
    const data = demoData();
    const day = data.sales[0].date;
    expect(recordedOn(data, day)).toBe(true);
    expect(recordedOn(data, "2020-01-01")).toBe(false);
  });

  it("greet by first name and give the week's numbers from the books", () => {
    expect(eveningText("Jehoshaphat Egbe")).toContain("Good evening Jehoshaphat");
    const data = demoData();
    const { text, params } = weeklySummary(data, "2026-10-04");
    expect(text).toContain("*Your week at Ada's Fashion*");
    expect(text).toContain("Sales: ₦");
    expect(params).toHaveLength(5);
  });
});
