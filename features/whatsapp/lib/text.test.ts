import { describe, expect, it } from "vitest";
import { answerToText, CANCEL, decision, lagosToday, SAVE } from "./text";

describe("decision", () => {
  it("reads button taps", () => {
    expect(decision({ buttonId: "save" })).toBe(SAVE);
    expect(decision({ buttonId: "cancel" })).toBe(CANCEL);
  });

  it.each(["yes", "Yes!", "  OK ", "save", "Save am"])("reads %j as Save", (text) => {
    expect(decision({ text })).toBe(SAVE);
  });

  it.each(["no", "NO.", "cancel", "don't save"])("reads %j as Cancel", (text) => {
    expect(decision({ text })).toBe(CANCEL);
  });

  it("treats anything else as a new note", () => {
    expect(decision({ text: "yes he paid 20k" })).toBeNull();
    expect(decision({ text: "Sold 2 shoes" })).toBeNull();
    expect(decision({})).toBeNull();
  });
});

describe("answerToText", () => {
  it("lists rows and the total", () => {
    expect(
      answerToText({ text: "2 customers owe you money:", rows: [{ label: "Chinedu", value: "₦25,000" }, { label: "Sarah", value: "₦20,000" }], total: { label: "Total outstanding", value: "₦45,000" } }),
    ).toBe("2 customers owe you money:\n• Chinedu: ₦25,000\n• Sarah: ₦20,000\n*Total outstanding: ₦45,000*");
  });
});

describe("lagosToday", () => {
  it("uses Nigerian time, an hour ahead of UTC", () => {
    // 23:30 UTC on the 29th is 00:30 on the 30th in Lagos.
    expect(lagosToday(new Date(Date.UTC(2026, 8, 29, 23, 30)))).toMatchObject({ today: "2026-09-30", weekday: "Wednesday" });
  });
});
