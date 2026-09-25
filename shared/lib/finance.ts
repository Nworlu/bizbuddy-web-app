// Every financial number shown in the app comes from these functions.
// They are pure and deterministic: no AI, no hidden state.

import { inRange, type DateRange } from "./dates";
import type { BizData, Customer, Payment, Sale } from "./types";

const sum = (values: number[]) => values.reduce((total, v) => total + v, 0);

export function paidForSale(saleId: string, payments: Payment[]): number {
  return sum(payments.filter((p) => p.saleId === saleId).map((p) => p.amount));
}

export function saleBalance(sale: Sale, payments: Payment[]): number {
  return Math.max(0, sale.totalAmount - paidForSale(sale.id, payments));
}

export interface CustomerTotals {
  totalSales: number;
  totalPaid: number;
  balance: number;
}

export function customerTotals(customerId: string, data: BizData): CustomerTotals {
  const sales = data.sales.filter((s) => s.customerId === customerId);
  return {
    totalSales: sum(sales.map((s) => s.totalAmount)),
    totalPaid: sum(data.payments.filter((p) => p.customerId === customerId).map((p) => p.amount)),
    balance: sum(sales.map((s) => saleBalance(s, data.payments))),
  };
}

export interface OwingCustomer {
  customer: Customer;
  balance: number;
}

/** Customers with an outstanding balance right now, largest first. Not affected by the date filter. */
export function customersOwing(data: BizData): OwingCustomer[] {
  return data.customers
    .map((customer) => ({ customer, balance: customerTotals(customer.id, data).balance }))
    .filter((x) => x.balance > 0)
    .sort((a, b) => b.balance - a.balance);
}

export interface PeriodSummary {
  /** Value of sales made in the period. */
  sales: number;
  /** Money received in the period, including payments against older sales. */
  collected: number;
  expenses: number;
}

export function periodSummary(data: BizData, range: DateRange): PeriodSummary {
  return {
    sales: sum(data.sales.filter((s) => inRange(s.date, range)).map((s) => s.totalAmount)),
    collected: sum(data.payments.filter((p) => inRange(p.date, range)).map((p) => p.amount)),
    expenses: sum(data.expenses.filter((e) => inRange(e.date, range)).map((e) => e.amount)),
  };
}

export type Activity =
  | { kind: "sale"; id: string; date: string; createdAt: string; customerName: string; product: string; amount: number; balance: number }
  | { kind: "payment"; id: string; date: string; createdAt: string; customerName: string; amount: number }
  | { kind: "expense"; id: string; date: string; createdAt: string; category: string; description: string; amount: number };

/**
 * Sales, later payments and expenses in the period, newest first.
 * A payment made on the same day as its sale is part of that sale, so it is not listed separately.
 */
export function recentActivity(data: BizData, range: DateRange, limit = 6): Activity[] {
  const names = new Map(data.customers.map((c) => [c.id, c.name]));
  const saleDates = new Map(data.sales.map((s) => [s.id, s.date]));

  const items: Activity[] = [
    ...data.sales
      .filter((s) => inRange(s.date, range))
      .map((s): Activity => ({
        kind: "sale",
        id: s.id,
        date: s.date,
        createdAt: s.createdAt,
        customerName: names.get(s.customerId) ?? "Unknown customer",
        product: s.product,
        amount: s.totalAmount,
        balance: saleBalance(s, data.payments),
      })),
    ...data.payments
      .filter((p) => inRange(p.date, range) && saleDates.get(p.saleId) !== p.date)
      .map((p): Activity => ({
        kind: "payment",
        id: p.id,
        date: p.date,
        createdAt: p.createdAt,
        customerName: names.get(p.customerId) ?? "Unknown customer",
        amount: p.amount,
      })),
    ...data.expenses
      .filter((e) => inRange(e.date, range))
      .map((e): Activity => ({
        kind: "expense",
        id: e.id,
        date: e.date,
        createdAt: e.createdAt,
        category: e.category,
        description: e.description,
        amount: e.amount,
      })),
  ];

  return items
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}
