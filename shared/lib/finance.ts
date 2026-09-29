// Every financial number shown in the app comes from these functions.
// They are pure and deterministic: no AI, no hidden state.

import { inRange, type DateRange } from "./dates";
import type { BizData, Customer, Expense, ExpenseCategory, LocalDate, Payment, PaymentMethod, Sale } from "./types";

const sum = (values: number[]) => values.reduce((total, v) => total + v, 0);

const oldestFirst = (a: Sale, b: Sale) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt);

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

/** Every customer with their balance: those who owe first (largest first), then everyone else by name. */
export function customersWithBalances(data: BizData): OwingCustomer[] {
  return data.customers
    .map((customer) => ({ customer, balance: customerTotals(customer.id, data).balance }))
    .sort((a, b) => b.balance - a.balance || a.customer.name.localeCompare(b.customer.name));
}

/** A customer's unpaid sales made on or before `date`, oldest first. */
export function openSales(customerId: string, data: BizData, date: LocalDate): Sale[] {
  return data.sales
    .filter((s) => s.customerId === customerId && s.date <= date && saleBalance(s, data.payments) > 0)
    .sort(oldestFirst);
}

/** What the customer owed on `date`. A payment can't cover a sale that hadn't happened yet. */
export function owedOn(customerId: string, data: BizData, date: LocalDate): number {
  return sum(openSales(customerId, data, date).map((s) => saleBalance(s, data.payments)));
}

export interface Allocation {
  sale: Sale;
  amount: number;
  /** True when this part pays the sale off completely. */
  clears: boolean;
}

/**
 * Splits one payment from a customer across their unpaid sales, oldest first.
 * Returns null when the amount is more than they owed on that date.
 */
export function allocatePayment(customerId: string, amount: number, date: LocalDate, data: BizData): Allocation[] | null {
  let left = amount;
  const parts: Allocation[] = [];
  for (const sale of openSales(customerId, data, date)) {
    if (left === 0) break;
    const owing = saleBalance(sale, data.payments);
    const part = Math.min(owing, left);
    parts.push({ sale, amount: part, clears: part === owing });
    left -= part;
  }
  return left > 0 ? null : parts;
}

export interface PaymentGroup {
  id: string;
  customerId: string;
  date: LocalDate;
  createdAt: string;
  method: PaymentMethod;
  amount: number;
  /** The sales this payment went to, with how much each received. */
  parts: { saleId: string; amount: number }[];
}

/**
 * Payments as the customer made them: parts of one split payment are joined back together.
 * Money paid at the moment of a sale is part of that sale, so it is left out.
 */
export function laterPayments(data: BizData, payments = data.payments): PaymentGroup[] {
  const saleDates = new Map(data.sales.map((s) => [s.id, s.date]));
  const groups = new Map<string, PaymentGroup>();
  for (const p of payments) {
    if (!p.batchId && saleDates.get(p.saleId) === p.date) continue;
    const key = p.batchId ?? p.id;
    const group = groups.get(key);
    if (group) {
      group.amount += p.amount;
      group.parts.push({ saleId: p.saleId, amount: p.amount });
    } else {
      groups.set(key, { id: key, customerId: p.customerId, date: p.date, createdAt: p.createdAt, method: p.method, amount: p.amount, parts: [{ saleId: p.saleId, amount: p.amount }] });
    }
  }
  return [...groups.values()];
}

/**
 * The payment (single or split) with this id: a batchId, or a lone payment's own id.
 * Deleting a payment always deletes the whole group, never part of a split.
 */
export function paymentGroup(groupId: string, payments: Payment[]): Payment[] {
  return payments.filter((p) => (p.batchId ?? p.id) === groupId);
}

/** Split payments that paid this sale and other sales too. Such a sale can't be deleted or moved to another customer until they are. */
export function sharedPaymentsForSale(saleId: string, payments: Payment[]): PaymentGroup[] {
  const batchIds = new Set(payments.filter((p) => p.saleId === saleId && p.batchId).map((p) => p.batchId!));
  const groups: PaymentGroup[] = [];
  for (const id of batchIds) {
    const parts = paymentGroup(id, payments);
    if (parts.some((p) => p.saleId !== saleId)) {
      groups.push({ id, customerId: parts[0].customerId, date: parts[0].date, createdAt: parts[0].createdAt, method: parts[0].method, amount: sum(parts.map((p) => p.amount)), parts: parts.map((p) => ({ saleId: p.saleId, amount: p.amount })) });
    }
  }
  return groups;
}

export type CustomerEvent =
  | { kind: "sale"; id: string; date: LocalDate; createdAt: string; sale: Sale; paid: number; balance: number }
  | { kind: "payment"; id: string; date: LocalDate; createdAt: string; payment: PaymentGroup };

/** A customer's sales and later payments, newest first. */
export function customerHistory(customerId: string, data: BizData): CustomerEvent[] {
  const sales = data.sales
    .filter((s) => s.customerId === customerId)
    .map((sale): CustomerEvent => ({ kind: "sale", id: sale.id, date: sale.date, createdAt: sale.createdAt, sale, paid: paidForSale(sale.id, data.payments), balance: saleBalance(sale, data.payments) }));
  const payments = laterPayments(data, data.payments.filter((p) => p.customerId === customerId)).map(
    (payment): CustomerEvent => ({ kind: "payment", id: payment.id, date: payment.date, createdAt: payment.createdAt, payment }),
  );
  return [...sales, ...payments].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
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

export interface ExpenseSummary {
  /** Expenses in the period, newest first. */
  expenses: Expense[];
  total: number;
  /** Spending per category in the period, largest first. */
  byCategory: { category: ExpenseCategory; amount: number }[];
}

export function expenseSummary(data: BizData, range: DateRange): ExpenseSummary {
  const expenses = data.expenses
    .filter((e) => inRange(e.date, range))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const totals = new Map<ExpenseCategory, number>();
  for (const e of expenses) totals.set(e.category, (totals.get(e.category) ?? 0) + e.amount);
  return {
    expenses,
    total: sum(expenses.map((e) => e.amount)),
    byCategory: [...totals].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
  };
}

export type Activity =
  | { kind: "sale"; id: string; date: string; createdAt: string; customerName: string; product: string; amount: number; balance: number }
  | { kind: "payment"; id: string; date: string; createdAt: string; customerName: string; amount: number }
  | { kind: "expense"; id: string; date: string; createdAt: string; category: string; description: string; amount: number };

/**
 * Sales, later payments and expenses in the period, newest first.
 * A payment made on the same day as its sale is part of that sale, so it is not listed separately,
 * and a payment split across several sales is listed once.
 */
export function recentActivity(data: BizData, range: DateRange, limit = 6): Activity[] {
  const names = new Map(data.customers.map((c) => [c.id, c.name]));

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
    ...laterPayments(data, data.payments.filter((p) => inRange(p.date, range))).map((p): Activity => ({
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
