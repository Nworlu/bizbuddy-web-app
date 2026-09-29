import { describe, expect, it } from "vitest";
import { formatDate, formatNaira, greeting, parseNaira } from "./format";

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
