import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { daysAgo, periodRange, today } from "./dates";
import { demoData } from "./demo";
import {
  allocatePayment,
  customerHistory,
  customersOwing,
  customersWithBalances,
  customerTotals,
  expenseSummary,
  laterPayments,
  openSales,
  owedOn,
  paidForSale,
  paymentGroup,
  periodSummary,
  recentActivity,
  saleBalance,
  sharedPaymentsForSale,
} from "./finance";
import type { BizData, Payment, Sale } from "./types";

// The demo shop is dated relative to today, so fix today: Tuesday 29 September 2026.
const NOW = new Date(2026, 8, 29, 12);
let data: BizData;

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
  data = demoData();
});
afterEach(() => vi.useRealTimers());

const sale = (id: string) => data.sales.find((s) => s.id === id)!;

/** Sarah (c2) owes ₦20,000 on Heels. Give her a second unpaid sale so a payment can span two sales. */
function addGele(): Sale {
  const gele: Sale = { id: "s-gele", customerId: "c2", product: "Gele", totalAmount: 15000, date: daysAgo(1), createdAt: `${daysAgo(1)}T12:00:00.000Z` };
  data.sales.push(gele);
  return gele;
}

function paySplit(amount: number, batchId = "B1"): Payment[] {
  const parts = allocatePayment("c2", amount, today(), data)!;
  const payments = parts.map((p, i): Payment => ({ id: `${batchId}-${i}`, saleId: p.sale.id, customerId: "c2", batchId, amount: p.amount, method: "Cash", date: today(), createdAt: `${today()}T13:00:00.000Z` }));
  data.payments.push(...payments);
  return payments;
}

describe("sale balances", () => {
  it("counts every payment on the sale, including later ones", () => {
    // Sneakers: ₦85,000, ₦50,000 at the sale, ₦20,000 a day later.
    expect(paidForSale("s1", data.payments)).toBe(70000);
    expect(saleBalance(sale("s1"), data.payments)).toBe(15000);
  });

  it("never goes below zero", () => {
    data.payments.push({ id: "extra", saleId: "s2", customerId: "c2", amount: 5000, method: "Cash", date: today(), createdAt: "x" });
    expect(saleBalance(sale("s2"), data.payments)).toBe(0);
  });
});

describe("customer totals", () => {
  it("adds up a customer's sales, payments, and balance", () => {
    expect(customerTotals("c1", data)).toEqual({ totalSales: 115000, totalPaid: 100000, balance: 15000 });
  });

  it("matches the sum of that customer's sale balances", () => {
    for (const c of data.customers) {
      const fromSales = data.sales.filter((s) => s.customerId === c.id).reduce((sum, s) => sum + saleBalance(s, data.payments), 0);
      expect(customerTotals(c.id, data).balance).toBe(fromSales);
    }
  });

  it("lists who owes, largest first", () => {
    expect(customersOwing(data).map((x) => [x.customer.name, x.balance])).toEqual([
      ["Chinedu Eze", 25000],
      ["Sarah Ibrahim", 20000],
      ["David Okafor", 15000],
    ]);
  });

  it("lists everyone: owing first, then paid-up customers by name", () => {
    expect(customersWithBalances(data).map((x) => x.customer.name)).toEqual(["Chinedu Eze", "Sarah Ibrahim", "David Okafor", "Amaka Johnson"]);
  });
});

describe("period summary", () => {
  it("this month", () => {
    expect(periodSummary(data, periodRange("month", NOW))).toEqual({ sales: 345000, collected: 285000, expenses: 169000 });
  });

  it("counts money collected by the day it arrived, even for an older sale", () => {
    // Monday's ₦20,000 from David was for a sale made on Sunday, before this week started.
    expect(periodSummary(data, periodRange("week", NOW))).toEqual({ sales: 0, collected: 20000, expenses: 0 });
  });

  it("last month", () => {
    expect(periodSummary(data, periodRange("last-month", NOW))).toEqual({ sales: 120000, collected: 120000, expenses: 150000 });
  });

  it("today, with nothing recorded", () => {
    expect(periodSummary(data, periodRange("today", NOW))).toEqual({ sales: 0, collected: 0, expenses: 0 });
  });
});

describe("paying off a customer's sales, oldest first", () => {
  it("fills the oldest unpaid sale first, then the next", () => {
    const gele = addGele();
    const parts = allocatePayment("c2", 25000, today(), data)!;
    expect(parts.map((p) => [p.sale.id, p.amount, p.clears])).toEqual([
      ["s6", 20000, true],
      [gele.id, 5000, false],
    ]);
  });

  it("refuses more than they owe", () => {
    addGele();
    expect(allocatePayment("c2", 35001, today(), data)).toBeNull();
    expect(allocatePayment("c2", 35000, today(), data)).not.toBeNull();
  });

  it("can't pay a sale made after the payment date", () => {
    addGele();
    expect(openSales("c2", data, daysAgo(5)).map((s) => s.id)).toEqual(["s6"]);
    expect(owedOn("c2", data, daysAgo(5))).toBe(20000);
    expect(allocatePayment("c2", 25000, daysAgo(5), data)).toBeNull();
  });
});

describe("payments as the customer made them", () => {
  it("leaves out money paid at the moment of a sale", () => {
    expect(laterPayments(data).map((g) => [g.id, g.amount])).toEqual([["p-late-1", 20000]]);
  });

  it("joins a split payment back into one", () => {
    addGele();
    paySplit(25000);
    const group = laterPayments(data).find((g) => g.id === "B1")!;
    expect(group.amount).toBe(25000);
    expect(group.parts).toHaveLength(2);
    expect(paymentGroup("B1", data.payments)).toHaveLength(2);
  });

  it("knows which sales share a split payment", () => {
    const gele = addGele();
    paySplit(25000);
    expect(sharedPaymentsForSale("s6", data.payments).map((g) => g.id)).toEqual(["B1"]);
    expect(sharedPaymentsForSale(gele.id, data.payments).map((g) => g.id)).toEqual(["B1"]);
    expect(sharedPaymentsForSale("s1", data.payments)).toEqual([]);
  });

  it("a split payment that went to one sale only is not shared", () => {
    paySplit(10000); // Sarah only owes on Heels, so it all goes there.
    expect(sharedPaymentsForSale("s6", data.payments)).toEqual([]);
  });
});

describe("customer history", () => {
  it("shows sales and later payments, newest first", () => {
    addGele();
    paySplit(25000);
    expect(customerHistory("c2", data).map((e) => `${e.kind}:${e.id}`)).toEqual(["payment:B1", "sale:s-gele", "sale:s2", "sale:s6"]);
  });
});

describe("recent activity", () => {
  it("lists sales, later payments, and expenses, newest first", () => {
    const items = recentActivity(data, periodRange("month", NOW), 50);
    expect(items[0]).toMatchObject({ kind: "payment", amount: 20000, customerName: "David Okafor" });
    const dates = items.map((i) => i.date);
    expect([...dates].sort().reverse()).toEqual(dates);
    // Payments made at the moment of a sale are part of the sale, not separate rows.
    expect(items.filter((i) => i.kind === "payment")).toHaveLength(1);
  });

  it("shows a split payment once", () => {
    addGele();
    paySplit(25000);
    const payments = recentActivity(data, periodRange("month", NOW), 50).filter((i) => i.kind === "payment");
    expect(payments.map((p) => p.amount).sort()).toEqual([20000, 25000]);
  });

  it("stops at the limit", () => {
    expect(recentActivity(data, periodRange("month", NOW))).toHaveLength(6);
  });
});

describe("expense summary", () => {
  it("totals the period and groups by category, largest first", () => {
    const summary = expenseSummary(data, periodRange("month", NOW));
    expect(summary.total).toBe(169000);
    expect(summary.expenses).toHaveLength(4);
    expect(summary.byCategory).toEqual([
      { category: "Stock", amount: 120000 },
      { category: "Transport", amount: 37000 },
      { category: "Packaging", amount: 8000 },
      { category: "Delivery", amount: 4000 },
    ]);
  });
});
