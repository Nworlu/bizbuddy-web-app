import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { demoData } from "@/shared/lib/demo";
import type { BizData } from "@/shared/lib/types";
import { answerQuestion } from "./answer";

// Tuesday 29 September 2026. The demo shop is dated relative to today.
const NOW = new Date(2026, 8, 29, 12);
let data: BizData;

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
  data = demoData();
});
afterEach(() => vi.useRealTimers());

const ask = (q: string) => answerQuestion(q, data, NOW);

describe("who owes me (BIZBUDDY_PLAN.md §13)", () => {
  it.each(["Who owes me?", "Who owes me money?", "outstanding debts"])("%s lists everyone owing, with the total", (q) => {
    const a = ask(q);
    expect(a.rows?.map((r) => `${r.label} ${r.value}`)).toEqual(["Chinedu Eze ₦25,000", "Sarah Ibrahim ₦20,000", "David Okafor ₦15,000"]);
    expect(a.total).toEqual({ label: "Total outstanding", value: "₦60,000" });
    expect(a.rows?.[0].href).toBe("/customers/view?id=c3");
  });

  it("says so when nobody owes", () => {
    data.sales = [];
    expect(ask("Who owes me?").text).toBe("Nobody owes you money right now.");
  });
});

describe("one customer", () => {
  it.each([
    ["How much does David owe?", "David Okafor owes you ₦15,000."],
    ["how much does chinedu eze owe", "Chinedu Eze owes you ₦25,000."],
    ["Did Amaka pay?", "Amaka Johnson has paid everything. They owe you nothing."],
    ["How much did David buy?", "David Okafor has bought ₦115,000 from you in total, and paid ₦100,000."],
  ])("%s", (q, text) => {
    expect(ask(q).text).toBe(text);
  });

  it("links to the customer", () => {
    expect(ask("How much does David owe?").link).toEqual({ label: "Open David Okafor", href: "/customers/view?id=c1" });
  });

  it("lists every customer who shares the first name", () => {
    data.customers.push({ id: "c9", name: "David Mark", phone: "", createdAt: "x" });
    const a = ask("How much does David owe?");
    expect(a.rows?.map((r) => r.label)).toEqual(["David Okafor", "David Mark"]);
  });

  it("prefers the full name when it's given", () => {
    data.customers.push({ id: "c9", name: "David Mark", phone: "", createdAt: "x" });
    expect(ask("How much does David Okafor owe?").text).toBe("David Okafor owes you ₦15,000.");
  });
});

describe("sales", () => {
  it.each(["How much did I sell?", "How much are my sales?", "What are my sales this month?"])("%s defaults to this month", (q) => {
    expect(ask(q).text).toBe("You recorded ₦345,000 in sales this month, across 6 sales. You collected ₦285,000 this month.");
  });

  it("last month", () => {
    expect(ask("sales last month").text).toBe("You recorded ₦120,000 in sales last month, across 1 sale. You collected ₦120,000 last month.");
  });

  it("today, with nothing recorded", () => {
    const a = ask("How much did I sell today?");
    expect(a.text).toBe("You haven't recorded any sales today.");
    expect(a.link?.href).toBe("/sales/new");
  });
});

describe("expenses", () => {
  it.each(["How much did I spend?", "What are my expenses?", "How much did I spend this month?"])("%s totals this month by category", (q) => {
    const a = ask(q);
    expect(a.text).toBe("You recorded ₦169,000 in expenses this month.");
    expect(a.rows?.[0]).toEqual({ label: "Stock", value: "₦120,000" });
  });

  it("last month", () => {
    expect(ask("How much did I spend last month?").text).toBe("You recorded ₦150,000 in expenses last month.");
  });
});

describe("money collected", () => {
  it("counts payments by the day they arrived", () => {
    expect(ask("How much have I collected this week?").text).toBe("You collected ₦20,000 this week, including payments on older sales.");
  });
});

describe("questions it can't answer", () => {
  it("offers the questions it can", () => {
    const a = ask("What's my profit?");
    expect(a.text).toMatch(/^I can answer questions about your sales/);
    expect(a.suggestions?.length).toBeGreaterThan(0);
  });
});
