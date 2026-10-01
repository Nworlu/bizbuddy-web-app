"use client";

// The books live in this browser's localStorage first, so everything works offline. Everything else
// in the app goes through useBizData() and the actions below.
//
// When the shop is linked to an account, every change is also queued in an outbox (shared/lib/sync.ts)
// and sent to the server when there is a connection (shared/lib/sync-runner.ts). The books and the
// outbox are saved together in one localStorage entry, so a change can never be saved without being
// queued, or queued without being saved.

import { useSyncExternalStore } from "react";
import { demoData } from "./demo";
import { customerNamed, findCustomerByName, isWholeNaira, tidyName, withCustomerPayment, withExpense, withSale, type CustomerPaymentInput, type ExpenseInput, type SaleInput } from "./actions";
import { paymentGroup, saleBalance, sharedPaymentsForSale } from "./finance";
import { diff, opKey, type NewOp, type Op, type SyncIO, type SyncMeta } from "./sync";
import type { BizData, BusinessType, Customer, Expense, ExpenseCategory, LocalDate, PaymentMethod } from "./types";

// Screens import these from the store; the rules themselves live in actions.ts.
export { findCustomerByName };

const STORAGE_KEY = "bizbuddy:v1";

const EMPTY: BizData = { version: 1, business: null, customers: [], sales: [], payments: [], expenses: [] };

/** What is saved under STORAGE_KEY: the books, plus the sync state once the shop is linked to an account. */
type Saved = BizData & { sync?: SyncMeta | null };

let state: BizData | undefined;
let meta: SyncMeta | null | undefined;
const listeners = new Set<() => void>();

function read(): { data: BizData; sync: SyncMeta | null } {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { data: EMPTY, sync: null };
    const parsed = JSON.parse(raw) as Saved;
    if (parsed?.version !== 1) return { data: EMPTY, sync: null };
    const { sync = null, ...data } = parsed;
    return { data, sync };
  } catch {
    return { data: EMPTY, sync: null };
  }
}

function load() {
  if (state === undefined || meta === undefined) {
    const saved = read();
    state = saved.data;
    meta = saved.sync;
  }
}

/** Saves the books and the sync state in one write. Throws if the browser refuses, and then nothing changes. */
function save(data: BizData, sync: SyncMeta | null) {
  const saved: Saved = sync ? { ...data, sync } : data;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  state = data;
  meta = sync;
  listeners.forEach((l) => l());
}

/** The outbox with these changes added. A later change to the same record replaces the earlier entry. */
function queued(sync: SyncMeta, ops: NewOp[]): SyncMeta {
  if (ops.length === 0) return sync;
  const outbox = { ...sync.outbox };
  let seq = sync.seq;
  for (const op of ops) outbox[opKey(op)] = { ...op, seq: ++seq } as Op;
  return { ...sync, outbox, seq };
}

/**
 * Replaces the books. Throws if the browser refuses to save, so callers can tell the user.
 * Linked to an account (and not the sample shop): the change is also queued for the server.
 */
function commit(next: BizData) {
  load();
  const sync = meta && !next.demo ? queued(meta, diff(state!, next)) : meta!;
  save(next, sync);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Keep other open tabs in sync.
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      const saved = read();
      state = saved.data;
      meta = saved.sync;
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
  load();
  return state!;
}

function getServerSnapshot(): undefined {
  return undefined;
}

/** The business data, or undefined while it is loading (during server render and hydration). */
export function useBizData(): BizData | undefined {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** The books as they are right now, e.g. just after saving (a component's `data` is from its last render). */
export function getBizData(): BizData {
  return getSnapshot();
}

// Sync state ----------------------------------------------------------------------------------------

/** The shop's link to its account, or null when the books live on this phone only. */
export function getSyncMeta(): SyncMeta | null {
  load();
  return meta!;
}

function getMetaSnapshot(): SyncMeta | null {
  return getSyncMeta();
}

/** Like getSyncMeta(), for components. null during server render too. */
export function useSyncMeta(): SyncMeta | null {
  return useSyncExternalStore(subscribe, getMetaSnapshot, () => null);
}

export function subscribeToStore(listener: () => void) {
  return subscribe(listener);
}

/**
 * Links this phone's shop to an account that was just created, and queues every record so the
 * account gets a full copy. Used after sign-up, including for books kept on the phone before accounts existed.
 */
export function linkShopToAccount(input: { userId: string; phone: string }) {
  load();
  if (state!.demo) throw new Error("The sample shop can't be linked to an account");
  let data = state!;
  if (data.business && !data.business.id) data = { ...data, business: { ...data.business, id: crypto.randomUUID() } };
  const sync: SyncMeta = { userId: input.userId, phone: input.phone, businessId: data.business?.id ?? null, lastPulledAt: null, outbox: {}, seq: 0 };
  save(data, queued(sync, diff(EMPTY, data)));
}

/**
 * Signs this phone into an existing account: the account's books replace what is here, on the next sync.
 * Refuses when this phone holds books that aren't in an account, so they're never lost by logging in.
 */
export function joinAccount(input: { userId: string; phone: string; businessId: string | null }) {
  load();
  if (!state!.demo && (state!.business || hasRecords(state!))) throw new Error("This phone has books that aren't in an account");
  save(EMPTY, { userId: input.userId, phone: input.phone, businessId: input.businessId, lastPulledAt: null, outbox: {}, seq: 0 });
}

/** Logs this phone out: the books and the outbox are removed from this phone. The account keeps its copy. */
export function unlinkPhone() {
  save(EMPTY, null);
}

/** How the sync runner reads and changes the books (see SyncIO in shared/lib/sync.ts). */
export const syncIO: SyncIO = {
  getData: () => getSnapshot(),
  getMeta: () => {
    const sync = getSyncMeta();
    if (!sync) throw new Error("Not linked to an account");
    return sync;
  },
  acknowledge(sent) {
    const sync = getSyncMeta();
    if (!sync || sent.length === 0) return;
    const outbox = { ...sync.outbox };
    for (const op of sent) {
      const key = opKey(op);
      if (outbox[key]?.seq === op.seq) delete outbox[key];
    }
    save(getSnapshot(), { ...sync, outbox });
  },
  applyPulled(next, lastPulledAt) {
    const sync = getSyncMeta();
    if (!sync) return;
    // Pulled changes are already on the server: save them without queueing them again.
    save(next, { ...sync, lastPulledAt });
  },
};

/** What the business is about, tidied and kept short (the server allows 300 characters). */
const tidyAbout = (about: string | undefined) => (about ?? "").replace(/\s+/g, " ").trim().slice(0, 300);

export function createBusiness(input: { name: string; ownerName: string; phone: string; type: BusinessType; about?: string }) {
  load();
  const about = tidyAbout(input.about);
  const business = { id: crypto.randomUUID(), name: input.name, ownerName: input.ownerName, phone: input.phone, type: input.type, ...(about ? { about } : {}), createdAt: new Date().toISOString() };
  // An account without a shop yet (e.g. created on another phone) gets this one.
  if (meta && !meta.businessId) meta = { ...meta, businessId: business.id };
  commit({ ...state!, business });
}

/** Changes the shop's details. The records stay as they are. */
export function updateBusiness(input: { name: string; ownerName: string; phone: string; type: BusinessType; about?: string }) {
  const data = getSnapshot();
  if (!data.business) throw new Error("No business to update");
  if (!input.name.trim() || !input.ownerName.trim()) throw new Error("Business and owner name are required");
  const about = input.about === undefined ? data.business.about : tidyAbout(input.about);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { about: _old, ...rest } = data.business;
  commit({ ...data, business: { ...rest, name: input.name.trim(), ownerName: input.ownerName.trim(), phone: input.phone.trim(), type: input.type, ...(about ? { about } : {}) } });
}

/** Deletes the shop and every record from this browser. Callers must confirm first. Signed in, use unlinkPhone() (log out) instead. */
export function resetAll() {
  if (getSyncMeta()) throw new Error("Log out instead: this would delete the account's books too");
  commit(EMPTY);
}

/** Creates the customer when the name is new, then the sale, then a payment when they paid something. */
export function recordSale(input: SaleInput) {
  const result = withSale(getSnapshot(), input);
  commit(result.data);
  return { customerName: result.customerName, outstanding: result.outstanding };
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

/** Records money a customer paid without naming a sale: their oldest unpaid sales are paid first. */
export function recordCustomerPayment(input: CustomerPaymentInput) {
  const result = withCustomerPayment(getSnapshot(), input);
  commit(result.data);
  return { parts: result.parts };
}

export function recordExpense(input: ExpenseInput): Expense {
  const result = withExpense(getSnapshot(), input);
  commit(result.data);
  return result.expense;
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

/** Replaces all existing records with the sample business. Callers must confirm first if data exists. Not while signed in. */
export function loadDemoData() {
  if (getSyncMeta()) throw new Error("Log out before opening the sample shop");
  commit(demoData());
}

export function hasRecords(data: BizData): boolean {
  return data.sales.length > 0 || data.expenses.length > 0 || data.customers.length > 0;
}
