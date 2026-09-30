"use client";

// V0.1 keeps all data in this browser's localStorage. Everything else in the app
// goes through useBizData() and the actions below, so this file is the only one
// that changes when we move to a real backend.

import { useSyncExternalStore } from "react";
import { demoData } from "./demo";
import { allocatePayment, paymentGroup, saleBalance, sharedPaymentsForSale } from "./finance";
import type { BizData, BusinessType, Customer, Expense, ExpenseCategory, LocalDate, Payment, PaymentMethod } from "./types";

const STORAGE_KEY = "bizbuddy:v1";

const EMPTY: BizData = { version: 1, business: null, customers: [], sales: [], payments: [], expenses: [] };

let state: BizData | undefined;
const listeners = new Set<() => void>();

function read(): BizData {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as BizData;
    return parsed?.version === 1 ? parsed : EMPTY;
  } catch {
    return EMPTY;
  }
}

/** Replaces the whole dataset. Throws if the browser refuses to save, so callers can tell the user. */
function commit(next: BizData) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  state = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Keep other open tabs in sync.
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      state = read();
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): BizData {
  if (state === undefined) state = read();
  return state;
}

function getServerSnapshot(): undefined {
  return undefined;
}

/** The business data, or undefined while it is loading (during server render and hydration). */
export function useBizData(): BizData | undefined {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function createBusiness(input: { name: string; ownerName: string; phone: string; type: BusinessType }) {
  commit({ ...getSnapshot(), business: { ...input, createdAt: new Date().toISOString() } });
}

/** Creates the customer when the name is new, then the sale, then a payment when they paid something. */
/** The customer with this name, or a new one added to the list. Sales find customers by name. */
function customerNamed(data: BizData, rawName: string): { customer: Customer; customers: Customer[] } {
  const name = tidyName(rawName);
  if (!name) throw new Error("Customer name is required");
  const existing = findCustomerByName(data, name);
  if (existing) return { customer: existing, customers: data.customers };
  const customer: Customer = { id: crypto.randomUUID(), name, phone: "", createdAt: new Date().toISOString() };
  return { customer, customers: [...data.customers, customer] };
}

/** Changes the shop's details. The records stay as they are. */
export function updateBusiness(input: { name: string; ownerName: string; phone: string; type: BusinessType }) {
  const data = getSnapshot();
  if (!data.business) throw new Error("No business to update");
  if (!input.name.trim() || !input.ownerName.trim()) throw new Error("Business and owner name are required");
  commit({ ...data, business: { ...data.business, name: input.name.trim(), ownerName: input.ownerName.trim(), phone: input.phone.trim(), type: input.type } });
}

/** Deletes the shop and every record from this browser. Callers must confirm first. */
export function resetAll() {
  commit(EMPTY);
}

export function recordSale(input: { customerName: string; product: string; totalAmount: number; amountPaid: number; method: PaymentMethod; date: LocalDate }) {
  if (!isWholeNaira(input.totalAmount) || input.totalAmount <= 0) throw new Error("Sale amount must be whole naira above 0");
  if (!isWholeNaira(input.amountPaid) || input.amountPaid < 0 || input.amountPaid > input.totalAmount) throw new Error("Amount paid must be whole naira, up to the sale amount");
  const data = getSnapshot();
  const { customer, customers } = customerNamed(data, input.customerName);
  const saleId = crypto.randomUUID();
  const sales = [...data.sales, { id: saleId, customerId: customer.id, product: input.product.trim(), totalAmount: input.totalAmount, date: input.date, createdAt: new Date().toISOString() }];
  const payments = input.amountPaid > 0 ? [...data.payments, { id: crypto.randomUUID(), saleId, customerId: customer.id, amount: input.amountPaid, method: input.method, date: input.date, createdAt: new Date().toISOString() }] : data.payments;
  commit({ ...data, customers, sales, payments });
  return { customerName: customer.name, outstanding: input.totalAmount - input.amountPaid };
}

/** Adds a later payment to one sale. The amount cannot be more than what is still owed. */
export function recordPayment(input: { saleId: string; amount: number; method: PaymentMethod; date: LocalDate }) {
  const data = getSnapshot();
  const sale = data.sales.find((item) => item.id === input.saleId);
  if (!sale) throw new Error("Sale not found");
  const owing = saleBalance(sale, data.payments);
  if (!isWholeNaira(input.amount) || input.amount <= 0 || input.amount > owing) throw new Error("Payment must be whole naira, up to what is still owed");
  const payment = { id: crypto.randomUUID(), saleId: sale.id, customerId: sale.customerId, amount: input.amount, method: input.method, date: input.date, createdAt: new Date().toISOString() };
  commit({ ...data, payments: [...data.payments, payment] });
  return { outstanding: owing - input.amount };
}

/** A name as typed, with spaces tidied: "  Sarah   Ibrahim " becomes "Sarah Ibrahim". */
function tidyName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/** The existing customer with this name, ignoring case and extra spaces anywhere in it. */
export function findCustomerByName(data: BizData, name: string): Customer | undefined {
  const wanted = tidyName(name).toLowerCase();
  return data.customers.find((customer) => tidyName(customer.name).toLowerCase() === wanted);
}

/** Adds a customer. Throws if the name is empty or already used, since sales find customers by name. */
export function addCustomer(input: { name: string; phone: string }): Customer {
  const data = getSnapshot();
  const name = tidyName(input.name);
  if (!name) throw new Error("Customer name is required");
  if (findCustomerByName(data, name)) throw new Error("A customer with that name already exists");
  const customer: Customer = { id: crypto.randomUUID(), name, phone: input.phone.trim(), createdAt: new Date().toISOString() };
  commit({ ...data, customers: [...data.customers, customer] });
  return customer;
}

/** Changes a customer's name or phone. The name must stay unique, since sales find customers by name. */
export function updateCustomer(input: { customerId: string; name: string; phone: string }) {
  const data = getSnapshot();
  const name = tidyName(input.name);
  if (!name) throw new Error("Customer name is required");
  if (!data.customers.some((c) => c.id === input.customerId)) throw new Error("Customer not found");
  const clash = findCustomerByName(data, name);
  if (clash && clash.id !== input.customerId) throw new Error("A customer with that name already exists");
  commit({ ...data, customers: data.customers.map((c) => (c.id === input.customerId ? { ...c, name, phone: input.phone.trim() } : c)) });
}

/** Deletes a customer with no sales. A customer with sales can't be deleted: delete or move their sales first. */
export function deleteCustomer(customerId: string) {
  const data = getSnapshot();
  if (data.sales.some((s) => s.customerId === customerId)) throw new Error("Customer still has sales");
  commit({ ...data, customers: data.customers.filter((c) => c.id !== customerId) });
}

/**
 * Records money a customer paid without naming a sale. It pays off their unpaid sales oldest first,
 * one Payment per sale, all sharing a batchId so they show as one payment.
 */
export function recordCustomerPayment(input: { customerId: string; amount: number; method: PaymentMethod; date: LocalDate }) {
  if (!isWholeNaira(input.amount) || input.amount <= 0) throw new Error("Payment must be whole naira above 0");
  const data = getSnapshot();
  const parts = allocatePayment(input.customerId, input.amount, input.date, data);
  if (!parts || parts.length === 0) throw new Error("Payment is more than what was owed on that date");
  const batchId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const payments: Payment[] = parts.map((part) => ({
    id: crypto.randomUUID(),
    saleId: part.sale.id,
    customerId: input.customerId,
    batchId,
    amount: part.amount,
    method: input.method,
    date: input.date,
    createdAt,
  }));
  commit({ ...data, payments: [...data.payments, ...payments] });
  return { parts };
}

export function recordExpense(input: { category: ExpenseCategory; amount: number; description: string; date: LocalDate }): Expense {
  if (!isWholeNaira(input.amount) || input.amount <= 0) throw new Error("Expense must be whole naira above 0");
  const data = getSnapshot();
  const expense: Expense = { id: crypto.randomUUID(), category: input.category, amount: input.amount, description: input.description.trim(), date: input.date, createdAt: new Date().toISOString() };
  commit({ ...data, expenses: [...data.expenses, expense] });
  return expense;
}

/**
 * Changes a sale. The total can't drop below what has been paid, and the date can't be after a payment on it.
 * Moving the sale to another customer moves its payments too, unless a split payment also paid other sales.
 */
export function updateSale(input: { saleId: string; customerName: string; product: string; totalAmount: number; date: LocalDate }) {
  const data = getSnapshot();
  const sale = data.sales.find((item) => item.id === input.saleId);
  if (!sale) throw new Error("Sale not found");
  const own = data.payments.filter((p) => p.saleId === sale.id);
  const paid = own.reduce((sum, p) => sum + p.amount, 0);
  if (!isWholeNaira(input.totalAmount) || input.totalAmount <= 0 || input.totalAmount < paid) throw new Error("Sale total must be whole naira and at least what has been paid");
  if (!input.product.trim()) throw new Error("Product is required");
  if (own.some((p) => p.date < input.date)) throw new Error("Sale date can't be after a payment on it");
  const { customer, customers } = customerNamed(data, input.customerName);
  if (customer.id !== sale.customerId && sharedPaymentsForSale(sale.id, data.payments).length > 0) throw new Error("A split payment also paid other sales for this customer");
  commit({
    ...data,
    customers,
    sales: data.sales.map((item) => (item.id === sale.id ? { ...item, customerId: customer.id, product: input.product.trim(), totalAmount: input.totalAmount, date: input.date } : item)),
    payments: data.payments.map((p) => (p.saleId === sale.id ? { ...p, customerId: customer.id } : p)),
  });
}

/** Deletes a sale and the payments on it. Refuses when a split payment also paid other sales: delete that payment first. */
export function deleteSale(saleId: string) {
  const data = getSnapshot();
  if (sharedPaymentsForSale(saleId, data.payments).length > 0) throw new Error("A split payment also paid other sales");
  commit({ ...data, sales: data.sales.filter((s) => s.id !== saleId), payments: data.payments.filter((p) => p.saleId !== saleId) });
}

/** Deletes a payment. A split payment is deleted whole, from every sale it paid. */
export function deletePayment(groupId: string) {
  const data = getSnapshot();
  if (paymentGroup(groupId, data.payments).length === 0) throw new Error("Payment not found");
  commit({ ...data, payments: data.payments.filter((p) => (p.batchId ?? p.id) !== groupId) });
}

export function updateExpense(input: { expenseId: string; category: ExpenseCategory; amount: number; description: string; date: LocalDate }) {
  if (!isWholeNaira(input.amount) || input.amount <= 0) throw new Error("Expense must be whole naira above 0");
  const data = getSnapshot();
  if (!data.expenses.some((e) => e.id === input.expenseId)) throw new Error("Expense not found");
  commit({
    ...data,
    expenses: data.expenses.map((e) => (e.id === input.expenseId ? { ...e, category: input.category, amount: input.amount, description: input.description.trim(), date: input.date } : e)),
  });
}

export function deleteExpense(expenseId: string) {
  const data = getSnapshot();
  commit({ ...data, expenses: data.expenses.filter((e) => e.id !== expenseId) });
}

/** Replaces all existing records with the sample business. Callers must confirm first if data exists. */
export function loadDemoData() {
  commit(demoData());
}

/** Money is stored in whole naira. The screen rounds to whole naira, so kobo would make balances look wrong. */
function isWholeNaira(amount: number): boolean {
  return Number.isSafeInteger(amount);
}

export function hasRecords(data: BizData): boolean {
  return data.sales.length > 0 || data.expenses.length > 0 || data.customers.length > 0;
}
