import { describe, expect, it } from "vitest";
import { EMPTY_MEMORY, learn, memoryForPrompt, parseMemory, type ShopMemory } from "./memory";
import type { Draft } from "./intents";

const sale: Draft = {
  kind: "sale",
  customer: "David Okafor",
  product: "Sneakers",
  total: 85000,
  paid: 50000,
  method: "Bank Transfer",
  date: "2026-09-30",
};

describe("learn", () => {
  it("remembers a confirmed sale, the product, and that they write 85k", () => {
    const next = learn(EMPTY_MEMORY, "Sold 2 sneakers to David for 85k, he paid 50k", sale);
    expect(next.products).toEqual(["Sneakers"]);
    expect(next.writesThousands).toBe(true);
    expect(next.lessons).toHaveLength(1);
    expect(next.lessons[0].meant).toContain("David Okafor bought Sneakers");
    expect(next.lessons[0].meant).toContain("paid");
  });

  it("keeps the eight newest notes and puts the latest first", () => {
    let memory: ShopMemory = EMPTY_MEMORY;
    for (let i = 0; i < 9; i++) memory = learn(memory, `note ${i}`, sale);
    expect(memory.lessons).toHaveLength(8);
    expect(memory.lessons[0].note).toBe("note 8");
    expect(memory.lessons.some((lesson) => lesson.note === "note 0")).toBe(false);
  });

  it("replaces an older lesson when they confirm the same wording again", () => {
    const first = learn(EMPTY_MEMORY, "sold sneakers", sale);
    const next = learn(first, "sold sneakers", { ...sale, product: "Caps", total: 10000, paid: 10000 });
    expect(next.lessons).toHaveLength(1);
    expect(next.lessons[0].meant).toContain("Caps");
    expect(next.products[0]).toBe("Caps");
  });

  it("does not add a product twice, ignoring case", () => {
    const next = learn(learn(EMPTY_MEMORY, "one", sale), "two", { ...sale, product: "sneakers" });
    expect(next.products).toEqual(["sneakers"]);
  });

  it("leaves the memory unchanged when the sale has no total", () => {
    expect(learn(EMPTY_MEMORY, "sold something", { ...sale, total: null })).toBe(EMPTY_MEMORY);
  });
});

describe("memoryForPrompt", () => {
  it("is empty until they have confirmed a note", () => {
    expect(memoryForPrompt(EMPTY_MEMORY)).toBeNull();
  });

  it("lists older notes first and says not to copy amounts from them", () => {
    const memory = learn(learn(EMPTY_MEMORY, "first note 85k", sale), "second note", { ...sale, product: "Caps" });
    const prompt = memoryForPrompt(memory)!;
    expect(prompt.indexOf("first note")).toBeLessThan(prompt.indexOf("second note"));
    expect(prompt).toContain("They sell: Caps, Sneakers.");
    expect(prompt).toContain("85k");
    expect(prompt).toContain("Never copy an amount");
  });
});

describe("parseMemory", () => {
  it("drops a lesson that isn't a note and what it meant", () => {
    expect(parseMemory({ products: ["Sneakers", 4], writesThousands: true, lessons: [{ note: "sold shoes", meant: "a sale" }, { note: "no" }] })).toEqual({
      products: ["Sneakers"],
      writesThousands: true,
      lessons: [{ note: "sold shoes", meant: "a sale" }],
    });
  });

  it("is empty for anything else", () => {
    expect(parseMemory(null)).toEqual(EMPTY_MEMORY);
  });
});
