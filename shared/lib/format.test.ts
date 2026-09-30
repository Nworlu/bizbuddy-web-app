import { describe, expect, it } from "vitest";
import { formatDate, formatNaira, greeting, parseNaira, periodPhrase } from "./format";

describe("parseNaira", () => {
  it.each([
    ["85000", 85000],
    ["85,000", 85000],
    ["₦85,000", 85000],
    [" 85 000 ", 85000],
    ["0", 0],
  ])("reads %j as %i", (input, expected) => {
    expect(parseNaira(input)).toBe(expected);
  });

  it.each(["", "   ", "85000.50", "4999.5", "-5000", "85k", "1e5", "abc", "99999999999999999999"])("rejects %j", (input) => {
    expect(parseNaira(input)).toBeNull();
  });
});

describe("formatNaira", () => {
  it("shows whole naira with a thousands separator", () => {
    expect(formatNaira(85000)).toBe("₦85,000");
    expect(formatNaira(0)).toBe("₦0");
  });
});

describe("formatDate", () => {
  it("shows the stored calendar date without shifting it a day", () => {
    const shown = formatDate("2026-09-01");
    expect(shown).toMatch(/^1 Sep/);
    expect(shown).toContain("2026");
  });
});

describe("greeting", () => {
  it("follows the time of day", () => {
    expect(greeting(new Date(2026, 8, 29, 9))).toBe("Good morning");
    expect(greeting(new Date(2026, 8, 29, 14))).toBe("Good afternoon");
    expect(greeting(new Date(2026, 8, 29, 19))).toBe("Good evening");
  });
});

describe("periodPhrase", () => {
  it("names a preset period", () => {
    expect(periodPhrase("month", { start: "2026-09-01", end: "2026-09-29" })).toBe("this month");
    expect(periodPhrase("last-month", { start: "2026-08-01", end: "2026-08-31" })).toBe("last month");
  });

  it("gives the dates of a custom range", () => {
    expect(periodPhrase("custom", { start: "2026-09-01", end: "2026-09-15" })).toMatch(/^from 1 Sep.* 2026 to 15 Sep.* 2026$/);
    expect(periodPhrase("custom", { start: "2026-09-03", end: "2026-09-03" })).toMatch(/^on 3 Sep.* 2026$/);
  });
});
