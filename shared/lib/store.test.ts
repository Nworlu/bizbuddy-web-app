import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { daysAgo, today } from "./dates";
import { customerTotals, saleBalance } from "./finance";
import type { BizData } from "./types";

// The store saves to window.localStorage. Give it an in-memory one.
const saved = new Map<string, string>();
let failWrites = false;
vi.stubGlobal("window", {
  localStorage: {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (failWrites) throw new Error("QuotaExceededError");
      saved.set(key, value);
    },
  },
  addEventListener() {},
  removeEventListener() {},
});

const store = await import("./store");
const read = (): BizData => JSON.parse(saved.get("bizbuddy:v1")!);
const sale = (id: string) => read().sales.find((s) => s.id === id)!;

beforeAll(() => vi.useFakeTimers({ now: new Date(2026, 8, 29, 12), toFake: ["Date"] }));
afterAll(() => vi.useRealTimers());
beforeEach(() => {
  failWrites = false;
  store.loadDemoData();
});
afterEach(() => {
  failWrites = false;
});

/** Sarah (c2) owes ₦20,000 on Heels (s6). Add Gele, then pay ₦25,000 across both. */
function sarahSplitPayment() {
  store.recordSale({ customerName: "Sarah Ibrahim", product: "Gele", totalAmount: 15000, amountPaid: 0, method: "Cash", date: daysAgo(1) });
  const gele = read().sales.find((s) => s.product === "Gele")!;
  store.recordCustomerPayment({ customerId: "c2", amount: 25000, method: "Cash", date: today() });
  const batchId = read().payments.find((p) => p.batchId)!.batchId!;
  return { gele, batchId };
}

describe("saving", () => {
  it("throws and keeps the old records when the browser refuses to save", () => {
    const before = saved.get("bizbuddy:v1");
    failWrites = true;
    expect(() => store.recordExpense({ category: "Rent", amount: 1000, description: "", date: today() })).toThrow();
    expect(saved.get("bizbuddy:v1")).toBe(before);
    failWrites = false;
    // The in-memory copy wasn't changed either: the next save starts from the old records.
    store.recordExpense({ category: "Rent", amount: 2000, description: "", date: today() });
    expect(read().expenses.filter((e) => e.category === "Rent").map((e) => e.amount)).toEqual([150000, 2000]);
  });
});

describe("recordSale", () => {
  it("adds a new customer, the sale, and a payment for what was paid", () => {
    const result = store.recordSale({ customerName: "  Musa Bello ", product: "iPhone 12", totalAmount: 250000, amountPaid: 100000, method: "Cash", date: today() });
    expect(result).toEqual({ customerName: "Musa Bello", outstanding: 150000 });
    const musa = read().customers.find((c) => c.name === "Musa Bello")!;
    const s = read().sales.find((x) => x.customerId === musa.id)!;
    expect(saleBalance(s, read().payments)).toBe(150000);
  });

  it("reuses a customer whatever the capitals or spaces", () => {
    store.recordSale({ customerName: "sarah  ibrahim", product: "Gele", totalAmount: 15000, amountPaid: 0, method: "Cash", date: today() });
    expect(read().customers).toHaveLength(4);
  });

  it("stores no payment when nothing was paid", () => {
    const before = read().payments.length;
    store.recordSale({ customerName: "David Okafor", product: "Cap", totalAmount: 5000, amountPaid: 0, method: "Cash", date: today() });
    expect(read().payments).toHaveLength(before);
  });

  it.each([
    ["kobo in the total", 85000.5, 0],
    ["a zero total", 0, 0],
    ["paying more than the total", 5000, 6000],
    ["kobo in the amount paid", 5000, 100.5],
  ])("refuses %s", (_label, totalAmount, amountPaid) => {
    expect(() => store.recordSale({ customerName: "David Okafor", product: "Cap", totalAmount, amountPaid, method: "Cash", date: today() })).toThrow();
  });
});

describe("recordPayment on one sale", () => {
  it("can't be more than the sale still owes", () => {
    expect(() => store.recordPayment({ saleId: "s1", amount: 15001, method: "Cash", date: today() })).toThrow();
    expect(store.recordPayment({ saleId: "s1", amount: 15000, method: "Cash", date: today() })).toEqual({ outstanding: 0 });
  });
});

describe("recordCustomerPayment", () => {
  it("splits one payment across sales, oldest first, under one batch", () => {
    const { gele, batchId } = sarahSplitPayment();
    const parts = read().payments.filter((p) => p.batchId === batchId);
    expect(parts.map((p) => [p.saleId, p.amount])).toEqual([
      ["s6", 20000],
      [gele.id, 5000],
    ]);
    expect(customerTotals("c2", read()).balance).toBe(10000);
  });

  it("refuses more than they owe", () => {
    expect(() => store.recordCustomerPayment({ customerId: "c2", amount: 20001, method: "Cash", date: today() })).toThrow();
  });
});

describe("addCustomer", () => {
  it("adds a customer and refuses a duplicate name", () => {
    store.addCustomer({ name: "Bisi Adeyemi", phone: "0802 222 3333" });
    expect(() => store.addCustomer({ name: "bisi adeyemi", phone: "" })).toThrow();
    expect(() => store.addCustomer({ name: "   ", phone: "" })).toThrow();
  });
});

describe("editing and deleting customers", () => {
  it("renames a customer and tidies the spaces", () => {
    store.updateCustomer({ customerId: "c1", name: "  David   Okafor Jnr ", phone: "0803 000 0000" });
    expect(read().customers.find((c) => c.id === "c1")).toMatchObject({ name: "David Okafor Jnr", phone: "0803 000 0000" });
  });

  it("keeps the same name with different capitals", () => {
    store.updateCustomer({ customerId: "c1", name: "david okafor", phone: "" });
    expect(read().customers.find((c) => c.id === "c1")?.name).toBe("david okafor");
  });

  it("refuses a name another customer already has, or an empty one", () => {
    expect(() => store.updateCustomer({ customerId: "c1", name: "sarah ibrahim", phone: "" })).toThrow();
    expect(() => store.updateCustomer({ customerId: "c1", name: "  ", phone: "" })).toThrow();
  });

  it("won't delete a customer who has sales", () => {
    expect(() => store.deleteCustomer("c1")).toThrow();
    expect(read().customers).toHaveLength(4);
  });

  it("deletes a customer with no sales", () => {
    const bisi = store.addCustomer({ name: "Bisi Adeyemi", phone: "" });
    store.deleteCustomer(bisi.id);
    expect(read().customers.some((c) => c.id === bisi.id)).toBe(false);
  });
});

describe("updateSale", () => {
  it("changes the product, total, and date", () => {
    store.updateSale({ saleId: "s1", customerName: "David Okafor", product: "Sneakers (Nike)", totalAmount: 90000, date: daysAgo(3) });
    expect(sale("s1")).toMatchObject({ product: "Sneakers (Nike)", totalAmount: 90000, date: daysAgo(3) });
    expect(saleBalance(sale("s1"), read().payments)).toBe(20000);
  });

  it("won't drop the total below what has been paid", () => {
    expect(() => store.updateSale({ saleId: "s1", customerName: "David Okafor", product: "Sneakers", totalAmount: 69999, date: daysAgo(2) })).toThrow();
  });

  it("won't move the date after a payment on the sale", () => {
    expect(() => store.updateSale({ saleId: "s1", customerName: "David Okafor", product: "Sneakers", totalAmount: 85000, date: today() })).toThrow();
  });

  it("moves the sale and its payments to another customer, creating them if new", () => {
    store.updateSale({ saleId: "s1", customerName: "Bisi Adeyemi", product: "Sneakers", totalAmount: 85000, date: daysAgo(2) });
    const bisi = read().customers.find((c) => c.name === "Bisi Adeyemi")!;
    expect(read().payments.filter((p) => p.saleId === "s1").every((p) => p.customerId === bisi.id)).toBe(true);
    expect(customerTotals(bisi.id, read()).balance).toBe(15000);
    expect(customerTotals("c1", read()).balance).toBe(0);
  });

  it("won't move a sale that shares a split payment with other sales", () => {
    sarahSplitPayment();
    expect(() => store.updateSale({ saleId: "s6", customerName: "David Okafor", product: "Heels", totalAmount: 60000, date: daysAgo(12) })).toThrow();
    // Staying with the same customer is fine.
    store.updateSale({ saleId: "s6", customerName: "Sarah Ibrahim", product: "Heels (red)", totalAmount: 65000, date: daysAgo(12) });
    expect(customerTotals("c2", read()).balance).toBe(15000);
  });
});

describe("deleting", () => {
  it("a sale takes its payments with it", () => {
    const before = read().payments.length;
    store.deleteSale("s1");
    expect(read().sales.some((s) => s.id === "s1")).toBe(false);
    expect(read().payments).toHaveLength(before - 2);
  });

  it("a sale that shares a split payment can't be deleted until the payment is", () => {
    const { gele, batchId } = sarahSplitPayment();
    expect(() => store.deleteSale("s6")).toThrow();
    expect(() => store.deleteSale(gele.id)).toThrow();
    store.deletePayment(batchId);
    expect(read().payments.some((p) => p.batchId === batchId)).toBe(false);
    expect(customerTotals("c2", read()).balance).toBe(35000);
    store.deleteSale(gele.id);
    expect(customerTotals("c2", read()).balance).toBe(20000);
  });

  it("a single payment", () => {
    store.deletePayment("p-late-1");
    expect(saleBalance(sale("s1"), read().payments)).toBe(35000);
    expect(() => store.deletePayment("nope")).toThrow();
  });

  it("an expense, after editing it", () => {
    store.updateExpense({ expenseId: "e2", category: "Transport", amount: 5000, description: "  Bike  ", date: daysAgo(6) });
    expect(read().expenses.find((e) => e.id === "e2")).toMatchObject({ category: "Transport", amount: 5000, description: "Bike" });
    expect(() => store.updateExpense({ expenseId: "e2", category: "Transport", amount: 50.5, description: "", date: daysAgo(6) })).toThrow();
    store.deleteExpense("e2");
    expect(read().expenses.some((e) => e.id === "e2")).toBe(false);
  });
});

describe("business and starting over", () => {
  it("updates the shop's details and keeps the records", () => {
    store.updateBusiness({ name: " Ada's Fashion House ", ownerName: "Ada", phone: "08099998888", type: "Fashion" });
    expect(read().business).toMatchObject({ name: "Ada's Fashion House", phone: "08099998888" });
    expect(read().sales).toHaveLength(7);
    expect(() => store.updateBusiness({ name: "", ownerName: "Ada", phone: "", type: "Fashion" })).toThrow();
  });

  it("keeps what the business is about, tidied, and clears it when emptied", () => {
    store.updateBusiness({ name: "Ada's Fashion", ownerName: "Ada", phone: "", type: "Fashion", about: "  Ankara gowns\n and bags  " });
    expect(read().business?.about).toBe("Ankara gowns and bags");
    store.updateBusiness({ name: "Ada's Fashion", ownerName: "Ada", phone: "", type: "Fashion" });
    expect(read().business?.about).toBe("Ankara gowns and bags"); // not given: unchanged
    store.updateBusiness({ name: "Ada's Fashion", ownerName: "Ada", phone: "", type: "Fashion", about: " " });
    expect(read().business).not.toHaveProperty("about");
  });

  it("resetAll deletes everything", () => {
    store.resetAll();
    expect(read()).toEqual({ version: 1, business: null, customers: [], sales: [], payments: [], expenses: [] });
    expect(store.hasRecords(read())).toBe(false);
  });

  it("loadDemoData replaces whatever was there", () => {
    store.resetAll();
    store.createBusiness({ name: "Tunde Gadgets", ownerName: "Tunde", phone: "", type: "Electronics" });
    store.loadDemoData();
    expect(read().business?.name).toBe("Ada's Fashion");
  });
});
