"use client";

// V0.1 keeps all data in this browser's localStorage. Everything else in the app
// goes through useBizData() and the actions below, so this file is the only one
// that changes when we move to a real backend.

import { useSyncExternalStore } from "react";
import { demoData } from "./demo";
import { allocatePayment, saleBalance } from "./finance";
import type { BizData, BusinessType, Customer, LocalDate, Payment, PaymentMethod } from "./types";

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
export function recordSale(input: { customerName: string; product: string; totalAmount: number; amountPaid: number; method: PaymentMethod; date: LocalDate }) {
  if (!isWholeNaira(input.totalAmount) || input.totalAmount <= 0) throw new Error("Sale amount must be whole naira above 0");
  if (!isWholeNaira(input.amountPaid) || input.amountPaid < 0 || input.amountPaid > input.totalAmount) throw new Error("Amount paid must be whole naira, up to the sale amount");
  const data = getSnapshot();
  const name = input.customerName.trim();
  const existing = findCustomerByName(data, name);
  const customer = existing ?? { id: crypto.randomUUID(), name, phone: "", createdAt: new Date().toISOString() };
  const saleId = crypto.randomUUID();
  const customers = existing ? data.customers : [...data.customers, customer];
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

/** The existing customer with this name, ignoring case and extra spaces. */
export function findCustomerByName(data: BizData, name: string): Customer | undefined {
  const wanted = name.trim().toLowerCase();
  return data.customers.find((customer) => customer.name.trim().toLowerCase() === wanted);
}

/** Adds a customer. Throws if the name is empty or already used, since sales find customers by name. */
export function addCustomer(input: { name: string; phone: string }): Customer {
  const data = getSnapshot();
  const name = input.name.trim();
  if (!name) throw new Error("Customer name is required");
  if (findCustomerByName(data, name)) throw new Error("A customer with that name already exists");
  const customer: Customer = { id: crypto.randomUUID(), name, phone: input.phone.trim(), createdAt: new Date().toISOString() };
  commit({ ...data, customers: [...data.customers, customer] });
  return customer;
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
