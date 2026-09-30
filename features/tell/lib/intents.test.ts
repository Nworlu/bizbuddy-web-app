import { describe, expect, it } from "vitest";
import { INTERPRETATION_SCHEMA, parseInterpretation, toDraft, type SaleAction } from "./intents";

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
    expect(toDraft({ kind: "expense", category: null, amount: 4000, description: " Dispatch ", date: null }, TODAY)).toEqual({
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
