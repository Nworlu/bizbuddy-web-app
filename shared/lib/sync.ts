// Offline-first sync between this phone and the shop's account on the server.
//
// The phone is where records live first. Every change is saved on the phone (shared/lib/store.ts) and
// also put in an outbox. When there is a connection, syncOnce() sends the outbox, then pulls whatever
// changed on the server (from another phone) since the last pull.
//
// Rules:
//   * A change still waiting in the outbox beats what the server has, so a pull never undoes
//     something recorded offline. The outbox is sent first, so the server catches up.
//   * Later changes to the same record replace earlier ones in the outbox: only the latest is sent.
//   * Deletes are sent as deleted = true, so other phones learn about them.
//   * The server's clock (updated_at) decides what is "new" on a pull, never the phone's.
//
// This file has no Supabase code. syncOnce() talks to a RemoteApi, so tests can use a pretend server.

import type { BizData, Business, BusinessType, Customer, Expense, ExpenseCategory, Payment, PaymentMethod, Sale } from "./types";

export const TABLES = ["customers", "sales", "payments", "expenses"] as const;
export type Table = (typeof TABLES)[number];

type RecordOf = { customers: Customer; sales: Sale; payments: Payment; expenses: Expense };
type AnyRecord = RecordOf[Table];

/** One change waiting to reach the server. */
export type Op =
  | { kind: "business"; business: Business & { id: string }; seq: number }
  | { kind: "record"; table: Table; id: string; row: AnyRecord; deleted: boolean; seq: number };

export type NewOp = Op extends infer T ? (T extends Op ? Omit<T, "seq"> : never) : never;

/** Where this phone's shop is in syncing with its account. Saved on the phone next to the records. */
export interface SyncMeta {
  userId: string;
  /** The account's phone number, 234XXXXXXXXXX. */
  phone: string;
  /** The account's shop, or null until one is created (an account made on another phone without finishing setup). */
  businessId: string | null;
  /** The newest server updated_at this phone has pulled, or null before the first pull. */
  lastPulledAt: string | null;
  /** Keyed by opKey(); a later change to the same record replaces the entry. */
  outbox: Record<string, Op>;
  /** Counter for Op.seq, so an op changed while it was being sent isn't acknowledged by mistake. */
  seq: number;
}

export function opKey(op: NewOp | Op): string {
  return op.kind === "business" ? "business" : `${op.table}:${op.id}`;
}

/** What changed between two versions of the books, as outbox entries. */
export function diff(prev: BizData, next: BizData): NewOp[] {
  const ops: NewOp[] = [];
  if (next.business?.id && JSON.stringify(prev.business) !== JSON.stringify(next.business)) {
    ops.push({ kind: "business", business: next.business as Business & { id: string } });
  }
  for (const table of TABLES) {
    const before = new Map<string, AnyRecord>((prev[table] as AnyRecord[]).map((r) => [r.id, r]));
    const after = new Map<string, AnyRecord>((next[table] as AnyRecord[]).map((r) => [r.id, r]));
    for (const [id, row] of after) {
      const old = before.get(id);
      if (!old || JSON.stringify(old) !== JSON.stringify(row)) ops.push({ kind: "record", table, id, row, deleted: false });
    }
    for (const [id, row] of before) {
      if (!after.has(id)) ops.push({ kind: "record", table, id, row, deleted: true });
    }
  }
  return ops;
}

// Mapping between the app's records and the database's rows ----------------------------------------

export type RemoteRow = Record<string, unknown> & { id: string; deleted?: boolean; updated_at?: string };

export interface RemoteBusiness {
  id: string;
  name: string;
  owner_name: string;
  phone: string;
  type: string;
  created_at: string;
  updated_at?: string;
}

export function businessToRemote(b: Business & { id: string }): RemoteBusiness {
  return { id: b.id, name: b.name, owner_name: b.ownerName, phone: b.phone ?? "", type: b.type, created_at: b.createdAt };
}

/** The server writes timestamps as "…+00:00"; the phone uses toISOString() ("…Z"). Store the phone's form. */
function isoTime(value: unknown): string {
  const time = new Date(String(value));
  return Number.isNaN(time.getTime()) ? String(value) : time.toISOString();
}

export function businessFromRemote(r: RemoteBusiness): Business {
  return { id: r.id, name: r.name, ownerName: r.owner_name, phone: r.phone, type: r.type as BusinessType, createdAt: isoTime(r.created_at) };
}

function sameBusiness(a: Business | null, b: Business): boolean {
  return !!a && a.id === b.id && a.name === b.name && a.ownerName === b.ownerName && (a.phone ?? "") === (b.phone ?? "") && a.type === b.type;
}

export function recordToRemote(table: Table, row: AnyRecord, businessId: string, deleted: boolean): RemoteRow {
  const base = { business_id: businessId, id: row.id, created_at: row.createdAt, deleted };
  switch (table) {
    case "customers": {
      const c = row as Customer;
      return { ...base, name: c.name, phone: c.phone };
    }
    case "sales": {
      const s = row as Sale;
      return { ...base, customer_id: s.customerId, product: s.product, total_amount: s.totalAmount, date: s.date };
    }
    case "payments": {
      const p = row as Payment;
      return { ...base, sale_id: p.saleId, customer_id: p.customerId, batch_id: p.batchId ?? null, amount: p.amount, method: p.method, date: p.date };
    }
    case "expenses": {
      const e = row as Expense;
      return { ...base, category: e.category, amount: e.amount, description: e.description, date: e.date };
    }
  }
}

export function recordFromRemote(table: Table, r: RemoteRow): AnyRecord {
  const createdAt = isoTime(r.created_at);
  switch (table) {
    case "customers":
      return { id: r.id, name: String(r.name), phone: String(r.phone ?? ""), createdAt };
    case "sales":
      return { id: r.id, customerId: String(r.customer_id), product: String(r.product), totalAmount: Number(r.total_amount), date: String(r.date), createdAt };
    case "payments": {
      const p: Payment = { id: r.id, saleId: String(r.sale_id), customerId: String(r.customer_id), amount: Number(r.amount), method: String(r.method) as PaymentMethod, date: String(r.date), createdAt };
      if (r.batch_id) p.batchId = String(r.batch_id);
      return p;
    }
    case "expenses":
      return { id: r.id, category: String(r.category) as ExpenseCategory, amount: Number(r.amount), description: String(r.description ?? ""), date: String(r.date), createdAt };
  }
}

/**
 * Puts rows pulled from the server into the books. Rows whose record still has a change waiting in
 * the outbox are skipped: the phone's change is newer and is about to be sent.
 */
export function mergeRemote(data: BizData, table: Table, rows: RemoteRow[], pending: Set<string>): BizData {
  if (rows.length === 0) return data;
  const byId = new Map<string, AnyRecord>((data[table] as AnyRecord[]).map((r) => [r.id, r]));
  for (const row of rows) {
    if (pending.has(`${table}:${row.id}`)) continue;
    if (row.deleted) byId.delete(row.id);
    else byId.set(row.id, recordFromRemote(table, row));
  }
  return { ...data, [table]: [...byId.values()] };
}

// One round of syncing ---------------------------------------------------------------------------------

export interface RemoteApi {
  upsertBusiness(row: RemoteBusiness): Promise<void>;
  getBusiness(): Promise<RemoteBusiness | null>;
  upsert(table: Table, rows: RemoteRow[]): Promise<void>;
  /** Rows changed at or after `since` (all rows when null), with their server updated_at. */
  pullSince(table: Table, since: string | null): Promise<RemoteRow[]>;
}

/** How syncOnce reads and changes this phone's books and sync state (shared/lib/store.ts in the app). */
export interface SyncIO {
  getData(): BizData;
  getMeta(): SyncMeta;
  /** Remove sent ops from the outbox, unless the record changed again while they were being sent. */
  acknowledge(sent: Op[]): void;
  /** Save pulled changes to the books without adding them to the outbox. */
  applyPulled(next: BizData, lastPulledAt: string | null): void;
}

/** Pulls overlap the last one by this much, so rows committed at nearly the same moment aren't missed. */
const PULL_OVERLAP_MS = 60_000;

export interface SyncResult {
  pushed: number;
  pulled: number;
}

/** Sends the outbox, then pulls changes from the server. Throws if the network or server fails; nothing is lost. */
export async function syncOnce(api: RemoteApi, io: SyncIO): Promise<SyncResult> {
  const meta = io.getMeta();
  const businessId = meta.businessId;
  // No shop yet, or the sample shop is open: nothing to send or receive.
  if (!businessId || io.getData().demo) return { pushed: 0, pulled: 0 };
  const ops = Object.values(meta.outbox);

  // 1. Push. The shop row first: the records refer to it.
  const businessOp = ops.find((op): op is Extract<Op, { kind: "business" }> => op.kind === "business");
  if (businessOp) await api.upsertBusiness(businessToRemote(businessOp.business));
  for (const table of TABLES) {
    const rows = ops
      .filter((op): op is Extract<Op, { kind: "record" }> => op.kind === "record" && op.table === table)
      .map((op) => recordToRemote(table, op.row, businessId, op.deleted));
    if (rows.length > 0) await api.upsert(table, rows);
  }
  io.acknowledge(ops);

  // 2. Pull what changed on the server since last time.
  const since = meta.lastPulledAt ? new Date(new Date(meta.lastPulledAt).getTime() - PULL_OVERLAP_MS).toISOString() : null;
  const pulled = await Promise.all(TABLES.map((table) => api.pullSince(table, since)));
  const remoteBusiness = await api.getBusiness();

  // Anything changed on the phone while we were pulling stays in the outbox and wins.
  const pending = new Set(Object.keys(io.getMeta().outbox));
  let data = io.getData();
  let newest = meta.lastPulledAt;
  let count = 0;
  TABLES.forEach((table, i) => {
    data = mergeRemote(data, table, pulled[i], pending);
    for (const row of pulled[i]) {
      count++;
      if (row.updated_at && (!newest || row.updated_at > newest)) newest = row.updated_at;
    }
  });
  if (remoteBusiness && !pending.has("business")) {
    const fromServer = businessFromRemote(remoteBusiness);
    if (!sameBusiness(data.business, fromServer)) data = { ...data, business: fromServer };
  }
  io.applyPulled(data, newest);
  return { pushed: ops.length, pulled: count };
}
