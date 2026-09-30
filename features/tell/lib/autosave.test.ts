import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { demoData } from "@/shared/lib/demo";
import { added, AUTO_SAVE_AFTER, needsAsking, offerDue, reviewed, undo, unusuallyBig, withAutoSave } from "./autosave";
import type { Draft } from "./intents";
import { EMPTY_MEMORY, type ShopMemory } from "./memory";
import { applyDraft } from "./drafts";

const TODAY = "2026-09-30";
beforeEach(() => vi.useFakeTimers({ now: new Date(2026, 8, 30, 12), toFake: ["Date"] }));
afterEach(() => vi.useRealTimers());

const sale: Draft = { kind: "sale", customer: "David Okafor", product: "Cap", total: 10000, paid: 10000, method: "Cash", date: TODAY };
const expense: Draft = { kind: "expense", category: "Delivery", amount: 3000, description: "Rider", date: TODAY };

describe("when to offer", () => {
  it("offers once, after enough drafts in a row saved just as read", () => {
    let memory: ShopMemory = EMPTY_MEMORY;
    for (let i = 0; i < AUTO_SAVE_AFTER - 1; i++) memory = reviewed(memory, "saved");
    expect(offerDue(memory)).toBe(false);
    memory = reviewed(memory, "saved");
    expect(offerDue(memory)).toBe(true);
    expect(offerDue(withAutoSave(memory, "offered"))).toBe(false);
    expect(offerDue(withAutoSave(memory, "declined"))).toBe(false);
  });

  it.each(["corrected", "cancelled", "undone"] as const)("starts the count again after a draft is %s", (review) => {
    const nine = { ...EMPTY_MEMORY, streak: 9 };
    expect(reviewed(nine, review).streak).toBe(0);
  });

  it("an auto-save proves nothing new, so the count stays", () => {
    const nine = { ...EMPTY_MEMORY, streak: 9 };
    expect(reviewed(nine, "auto")).toBe(nine);
  });
});

describe("what still needs asking", () => {
  const data = demoData();

  it("saves a complete sale to a customer, and an ordinary expense, without asking", () => {
    expect(needsAsking(sale, data, TODAY)).toBeNull();
    expect(needsAsking(expense, data, TODAY)).toBeNull();
  });

  it("asks about payments, new customers, incomplete drafts, and big amounts", () => {
    expect(needsAsking({ kind: "payment", customer: "Sarah Ibrahim", amount: 5000, method: "Cash", date: TODAY }, data, TODAY)).toBe("payment");
    expect(needsAsking({ ...sale, customer: "Mordecai" }, data, TODAY)).toBe("new customer");
    expect(needsAsking({ ...sale, total: null }, data, TODAY)).toBe("incomplete");
    expect(needsAsking({ ...sale, total: 4_500_000, paid: 0 }, data, TODAY)).toBe("big amount");
  });

  it("calls anything big until the shop has a few records of that kind", () => {
    expect(unusuallyBig("expense", 100, { ...data, expenses: data.expenses.slice(0, 2) })).toBe(true);
  });
});

describe("undo", () => {
  it("takes out exactly what the auto-save added: the sale and its payment", () => {
    const before = demoData();
    const after = applyDraft(before, sale).data;
    const what = added(before, after);
    expect(what.sales).toHaveLength(1);
    const back = undo(after, what);
    expect(back.sales).toEqual(before.sales);
    expect(back.payments).toEqual(before.payments);
  });
});
