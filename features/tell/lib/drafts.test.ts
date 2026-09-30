import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { demoData } from "@/shared/lib/demo";
import { customerTotals } from "@/shared/lib/finance";
import type { BizData } from "@/shared/lib/types";
import { applyDraft, checkDraft, describeDraft } from "./drafts";
import type { Draft } from "./intents";

const TODAY = "2026-09-30";
let data: BizData;
beforeEach(() => {
  vi.useFakeTimers({ now: new Date(2026, 8, 30, 12), toFake: ["Date"] });
  data = demoData();
});
afterEach(() => vi.useRealTimers());

const sale = (over: Partial<Extract<Draft, { kind: "sale" }>> = {}): Draft => ({ kind: "sale", customer: "David Okafor", product: "Cap", total: 10000, paid: 4000, method: "Cash", date: TODAY, ...over });
const payment = (over: Partial<Extract<Draft, { kind: "payment" }>> = {}): Draft => ({ kind: "payment", customer: "Sarah Ibrahim", amount: 5000, method: "POS", date: TODAY, ...over });

describe("checkDraft", () => {
  it("accepts a complete sale, expense, and payment", () => {
    expect(checkDraft(sale(), data, TODAY)).toBeNull();
    expect(checkDraft({ kind: "expense", category: "Delivery", amount: 4000, description: "", date: TODAY }, data, TODAY)).toBeNull();
    expect(checkDraft(payment(), data, TODAY)).toBeNull();
  });

  it.each([
    [sale({ total: null }), "How much was the sale? Whole naira, like 85000."],
    [sale({ customer: " " }), "Who bought it?"],
    [sale({ paid: 20000 }), "They can't pay more than the sale amount."],
    [sale({ date: "2026-10-01" }), "The date can't be in the future."],
    [payment({ customer: "Bisi" }), "Bisi isn't one of your customers. Check the name."],
    [payment({ amount: 20001 }), "Sarah Ibrahim owed ₦20,000. The payment can't be more than that."],
    [payment({ customer: "Amaka Johnson" }), "Amaka Johnson didn't owe anything then."],
  ])("explains what's wrong: %#", (draft, message) => {
    expect(checkDraft(draft, data, TODAY)).toBe(message);
  });
});

describe("describeDraft", () => {
  it("shows the sums the app worked out", () => {
    expect(describeDraft(sale({ total: 85000, paid: 50000, customer: "david okafor", product: "Sneakers (2)" }), data)).toBe(
      "*Sale* · David Okafor · Sneakers (2)\nTotal ₦85,000 · Paid ₦50,000 (Cash)\nStill owes ₦35,000\n30 Sept 2026".replace("Sept", formatMonth()),
    );
  });

  it("flags a new customer and a missing total", () => {
    expect(describeDraft(sale({ customer: "Bisi", total: null, paid: 0 }), data)).toContain("Bisi (new customer)");
    expect(describeDraft(sale({ customer: "Bisi", total: null, paid: 0 }), data)).toContain("Total: ?");
  });

  it("shows what the customer owes before and after a payment", () => {
    expect(describeDraft(payment(), data)).toContain("Owes ₦20,000 now, ₦15,000 after this");
  });
});

describe("applyDraft", () => {
  it("records by the same rules as the app", () => {
    const before = customerTotals("c1", data).balance;
    const saved = applyDraft(data, sale());
    // Like the app's own message: what is still owed on this sale (David owes more on older sales).
    expect(saved.text).toBe("Sale recorded. David Okafor still owes ₦6,000.");
    expect(customerTotals("c1", saved.data).balance).toBe(before + 6000);
    expect(saved.customerId).toBe("c1");
  });

  it("pays a customer's oldest sale first", () => {
    const saved = applyDraft(data, payment({ amount: 20000 }));
    expect(saved.text).toBe("Payment recorded. Sarah Ibrahim is paid up.");
    expect(customerTotals("c2", saved.data).balance).toBe(0);
  });
});

/** en-NG writes September as "Sept" or "Sep" depending on the ICU version. */
function formatMonth() {
  return new Date(2026, 8, 30).toLocaleDateString("en-NG", { month: "short" });
}
