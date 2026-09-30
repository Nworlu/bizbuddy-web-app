import { describe, expect, it } from "vitest";
import { eitherDrafts, INTERPRETATION_SCHEMA, parseInterpretation, settleDirection, toDraft, type EitherAction, type SaleAction } from "./intents";

const TODAY = "2026-09-30";
const sale = (over: Partial<SaleAction>): SaleAction => ({
  kind: "sale", customer: "David", product: "Sneakers", quantity: null, unit_price: null, total_amount: null, amount_paid: null, method: null, date: null, ...over,
});

describe("toDraft: the app does the maths, not the model", () => {
  it("uses the total when the message gives one", () => {
    expect(toDraft(sale({ total_amount: 85000, amount_paid: 50000 }), TODAY)).toEqual({
      kind: "sale", customer: "David", product: "Sneakers", total: 85000, paid: 50000, method: "Cash", date: TODAY,
    });
  });

  it("works out unit price × quantity itself", () => {
    const draft = toDraft(sale({ quantity: 2, unit_price: 40000 }), TODAY);
    expect(draft).toMatchObject({ total: 80000, product: "Sneakers (2)" });
  });

  it("leaves an unknown total empty for the owner to fill in, never guesses", () => {
    expect(toDraft(sale({}), TODAY)).toMatchObject({ total: null, paid: 0 });
  });

  it("drops amounts that aren't whole naira above zero", () => {
    expect(toDraft(sale({ total_amount: 850.5, amount_paid: -5 }), TODAY)).toMatchObject({ total: null, paid: 0 });
  });

  it("keeps a date the message gave, and uses today otherwise", () => {
    expect(toDraft(sale({ date: "2026-09-29" }), TODAY)).toMatchObject({ date: "2026-09-29" });
    expect(toDraft(sale({ date: "yesterday" }), TODAY)).toMatchObject({ date: TODAY });
  });

  it("fills sensible defaults for an expense and a payment", () => {
    expect(toDraft({ kind: "expense", category: null, amount: 4000, description: " Dispatch ", spent_by: null, date: null }, TODAY)).toEqual({
      kind: "expense", category: "Other", amount: 4000, description: "Dispatch", date: TODAY,
    });
    expect(toDraft({ kind: "payment", customer: "Musa", amount: 20000, method: "POS", date: null }, TODAY)).toEqual({
      kind: "payment", customer: "Musa", amount: 20000, method: "POS", date: TODAY,
    });
  });
});

describe("parseInterpretation", () => {
  it("reads actions and ignores unknown kinds", () => {
    const parsed = parseInterpretation(JSON.stringify({ actions: [{ kind: "unclear", reply: "Which customer?" }, { kind: "hack" }] }));
    expect(parsed.actions).toEqual([{ kind: "unclear", reply: "Which customer?" }]);
  });

  it("throws on something that isn't an interpretation", () => {
    expect(() => parseInterpretation("{}")).toThrow();
    expect(() => parseInterpretation("not json")).toThrow();
  });
});

describe("the schema sent to Claude", () => {
  it("closes every object, as structured outputs require", () => {
    const objects: Record<string, unknown>[] = [];
    const walk = (node: unknown) => {
      if (!node || typeof node !== "object") return;
      const n = node as Record<string, unknown>;
      if (n.type === "object") objects.push(n);
      Object.values(n).forEach(walk);
    };
    walk(INTERPRETATION_SCHEMA);
    expect(objects.length).toBeGreaterThan(5);
    for (const o of objects) {
      expect(o.additionalProperties).toBe(false);
      expect(o.required).toEqual(Object.keys(o.properties as object));
    }
  });
});

describe("which way the money went", () => {
  const CUSTOMERS = ["Musa Bello", "David Okafor"];
  const laptop = sale({ customer: "Mordecai", product: "Laptop", total_amount: 450000, amount_paid: 85000, method: "Bank Transfer" });

  it("asks about a sale to someone who isn't a customer yet, when the note has no buying word", () => {
    expect(settleDirection([laptop], "Mordecai sent 85k for laptop of 450k", CUSTOMERS)).toEqual([
      { kind: "either", person: "Mordecai", what: "Laptop", amount: 85000, price: 450000, category: null, method: "Bank Transfer", date: null },
    ]);
  });

  it("keeps the sale for a known customer, or when the note says sold or bought", () => {
    const musa = sale({ customer: "Musa Bello", total_amount: 50000 });
    expect(settleDirection([musa], "Musa sent 50k for the gown", CUSTOMERS)).toEqual([musa]);
    expect(settleDirection([laptop], "Sold laptop to Mordecai for 450k, he sent 85k", CUSTOMERS)).toEqual([laptop]);
    expect(settleDirection([laptop], "Mordecai bought laptop 450k, sent 85k", CUSTOMERS)).toEqual([laptop]);
  });

  it("uses the total as the amount sent when nothing was said as paid", () => {
    const [either] = settleDirection([sale({ customer: "Tunde", total_amount: 50000 })], "Tunde sent 50k for phone", CUSTOMERS);
    expect(either).toMatchObject({ kind: "either", amount: 50000, price: null });
  });

  it("builds both readings: the person paying for it, or spending it for the shop", () => {
    const action: EitherAction = { kind: "either", person: "Mordecai", what: "Laptop", amount: 85000, price: 450000, category: "Stock", method: null, date: null };
    expect(eitherDrafts(action, TODAY)).toEqual({
      sale: { kind: "sale", customer: "Mordecai", product: "Laptop", total: 450000, paid: 85000, method: "Bank Transfer", date: TODAY },
      expense: { kind: "expense", category: "Stock", amount: 85000, description: "Laptop, paid by Mordecai", by: "Mordecai", date: TODAY },
    });
  });

  it("notes who on the team paid an expense", () => {
    expect(toDraft({ kind: "expense", category: "Stock", amount: 15000, description: "Supplier", spent_by: "Mordecai", date: null }, TODAY)).toEqual({
      kind: "expense", category: "Stock", amount: 15000, description: "Supplier, paid by Mordecai", by: "Mordecai", date: TODAY,
    });
  });
});
