"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { today } from "@/shared/lib/dates";
import { customerTotals } from "@/shared/lib/finance";
import { formatNaira, parseNaira } from "@/shared/lib/format";
import { routes } from "@/shared/lib/routes";
import { deleteExpense, deleteSale, findCustomerByName, getBizData, recordCustomerPayment, recordExpense, recordSale } from "@/shared/lib/store";
import { EXPENSE_CATEGORIES, PAYMENT_METHODS, type BizData, type ExpenseCategory, type PaymentMethod } from "@/shared/lib/types";
import { added, type Review, type Undo } from "../lib/autosave";
import { checkDraft, MISSING_QUESTIONS } from "../lib/drafts";
import { rememberShop } from "../lib/client";
import type { Draft, ExpenseDraft, PaymentDraft, SaleDraft } from "../lib/intents";

type Done = { text: string; href?: string };

type DraftCardProps = {
  draft: Draft;
  data: BizData;
  note?: string;
  /** False for the two readings of "sale or expense?": BizBuddy had to ask, so saving one doesn't show it read the note right. */
  counts?: boolean;
  /** Called when BizBuddy has read enough notes right in a row to offer auto-save. */
  onOffer?: () => void;
  /** Called once the owner saves or discards it, so the screen can stop reminding them. */
  onSettled?: () => void;
};

/**
 * A draft of what Tell BizBuddy understood. Every field can be corrected; nothing is saved until
 * Save, which goes through the same store rules as the forms (whole naira, no overpaying, and so on).
 */
export function DraftCard({ draft, data, note, counts = true, onOffer, onSettled }: DraftCardProps) {
  const [done, setDone] = useState<Done | null>(null);
  const [discarded, setDiscarded] = useState(false);

  /** Remembers the saved note, and whether it was saved just as BizBuddy read it. */
  function learned(saved: Draft) {
    const review: Review = !counts ? "auto" : sameDraft(saved, withoutBy(draft)) ? "saved" : "corrected";
    void rememberShop(note ?? "", { ...saved, ...(draft.kind === "expense" && draft.by && saved.kind === "expense" ? { by: draft.by } : {}) }, review).then((offer) => {
      if (offer) onOffer?.();
    });
  }

  function finish(result: Done) {
    setDone(result);
    onSettled?.();
  }

  function discard() {
    setDiscarded(true);
    onSettled?.();
    if (counts) void rememberShop(note ?? "", null, "cancelled");
  }

  if (discarded) return <p className="text-xs text-ink-muted">Not saved.</p>;
  if (done) {
    return (
      <div className="rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-800">
        <p className="font-semibold">✓ {done.text}</p>
        {done.href && <Link href={done.href} className="mt-1 inline-block text-xs font-semibold underline">Open</Link>}
      </div>
    );
  }
  // Something the note didn't say (who bought it, what, how much): asked straight away, above the fields.
  const problem = checkDraft(draft, data, today());
  const ask = problem && MISSING_QUESTIONS.has(problem) ? problem : null;
  const props = { data, note, ask, onDone: finish, onDiscard: discard, onSaved: learned };
  if (draft.kind === "sale") return <SaleCard draft={draft} {...props} />;
  if (draft.kind === "expense") return <ExpenseCard draft={draft} {...props} />;
  return <PaymentCard draft={draft} {...props} />;
}

type CardProps<T> = { draft: T; data: BizData; note?: string; ask: string | null; onDone: (done: Done) => void; onDiscard: () => void; onSaved: (saved: Draft) => void };

/** Saved just as BizBuddy read it, ignoring case and spacing ("musa" and "Musa" are the same). */
function sameDraft(a: Draft, b: Draft): boolean {
  const tidy = (draft: Draft) => JSON.stringify(Object.entries(draft).sort(([x], [y]) => x.localeCompare(y)).map(([k, v]) => [k, typeof v === "string" ? v.replace(/\s+/g, " ").trim().toLowerCase() : v]));
  return tidy(a) === tidy(b);
}

/** The draft as the card compares it: the team member is kept aside, not a field the owner edits. */
function withoutBy(draft: Draft): Draft {
  if (draft.kind !== "expense" || !draft.by) return draft;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { by, ...rest } = draft;
  return rest;
}

const SAVE_FAILED = "This browser couldn't save it. Check that site data is allowed, then try again.";

function SaleCard({ draft, data, ask, onDone, onDiscard, onSaved }: CardProps<SaleDraft>) {
  const [customer, setCustomer] = useState(draft.customer);
  const [product, setProduct] = useState(draft.product);
  const [total, setTotal] = useState(draft.total ? String(draft.total) : "");
  const [paid, setPaid] = useState(draft.paid ? String(draft.paid) : "");
  const [method, setMethod] = useState<PaymentMethod>(draft.method);
  const [date, setDate] = useState(draft.date);
  const [error, setError] = useState<string | null>(null);

  const totalNum = parseNaira(total);
  const paidNum = paid.trim() === "" ? 0 : parseNaira(paid);
  const existing = customer.trim() ? findCustomerByName(data, customer) : undefined;
  const owing = totalNum !== null && paidNum !== null && paidNum <= totalNum ? totalNum - paidNum : null;

  function save() {
    if (paidNum === null) return setError("Enter what they paid in whole naira, or leave it empty.");
    const problem = checkDraft({ kind: "sale", customer, product, total: totalNum && totalNum > 0 ? totalNum : null, paid: paidNum, method, date }, data, today());
    if (problem || totalNum === null) return setError(problem ?? "How much was the sale?");
    try {
      const result = recordSale({ customerName: customer, product, totalAmount: totalNum, amountPaid: paidNum, method, date });
      const customerId = findCustomerByName(getBizData(), result.customerName)?.id;
      onSaved({ kind: "sale", customer: result.customerName, product, total: totalNum, paid: paidNum, method, date });
      onDone({
        text: `Sale recorded. ${result.outstanding > 0 ? `${result.customerName} still owes ${formatNaira(result.outstanding)}.` : `${result.customerName} paid in full.`}`,
        href: customerId ? routes.customer(customerId) : undefined,
      });
    } catch {
      setError(SAVE_FAILED);
    }
  }

  return (
    <Card title="Record this sale?" ask={ask} error={error} onSave={save} onDiscard={onDiscard}>
      <TextField label="Customer" value={customer} onChange={setCustomer} hint={customer.trim() ? (existing ? `Existing customer: ${existing.name}` : "New customer") : undefined} />
      <TextField label="Product" value={product} onChange={setProduct} />
      <div className="grid grid-cols-2 gap-2">
        <MoneyField label="Sale total" value={total} onChange={setTotal} />
        <MoneyField label="Paid now" value={paid} onChange={setPaid} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <SelectField label="Paid by" value={method} options={PAYMENT_METHODS} onChange={(v) => setMethod(v as PaymentMethod)} />
        <DateField value={date} onChange={setDate} />
      </div>
      {owing !== null && (
        <p className={`rounded-lg px-3 py-2 text-sm font-semibold ${owing > 0 ? "bg-amber-50 text-amber-800" : "bg-brand-50 text-brand-800"}`}>
          {owing > 0 ? `Still owes ${formatNaira(owing)}` : "Paid in full"}
        </p>
      )}
    </Card>
  );
}

function ExpenseCard({ draft, data, ask, onDone, onDiscard, onSaved }: CardProps<ExpenseDraft>) {
  const [category, setCategory] = useState<ExpenseCategory>(draft.category);
  const [amount, setAmount] = useState(draft.amount ? String(draft.amount) : "");
  const [description, setDescription] = useState(draft.description);
  const [date, setDate] = useState(draft.date);
  const [error, setError] = useState<string | null>(null);

  function save() {
    const value = parseNaira(amount);
    const problem = checkDraft({ kind: "expense", category, amount: value && value > 0 ? value : null, description, date }, data, today());
    if (problem || value === null) return setError(problem ?? "How much did you spend?");
    try {
      recordExpense({ category, amount: value, description, date });
      onSaved({ kind: "expense", category, amount: value, description, date });
      onDone({ text: `Expense recorded. ${category}: ${formatNaira(value)}.`, href: "/expenses" });
    } catch {
      setError(SAVE_FAILED);
    }
  }

  return (
    <Card title="Record this expense?" ask={ask} error={error} onSave={save} onDiscard={onDiscard}>
      <div className="grid grid-cols-2 gap-2">
        <SelectField label="Category" value={category} options={EXPENSE_CATEGORIES} onChange={(v) => setCategory(v as ExpenseCategory)} />
        <MoneyField label="Amount" value={amount} onChange={setAmount} />
      </div>
      <TextField label="Note" value={description} onChange={setDescription} />
      <DateField value={date} onChange={setDate} />
    </Card>
  );
}

function PaymentCard({ draft, data, ask, onDone, onDiscard, onSaved }: CardProps<PaymentDraft>) {
  const [customer, setCustomer] = useState(draft.customer);
  const [amount, setAmount] = useState(draft.amount ? String(draft.amount) : "");
  const [method, setMethod] = useState<PaymentMethod>(draft.method);
  const [date, setDate] = useState(draft.date);
  const [error, setError] = useState<string | null>(null);

  const match = customer.trim() ? findCustomerByName(data, customer) : undefined;
  const owes = match ? customerTotals(match.id, data).balance : 0;

  function save() {
    const value = parseNaira(amount);
    const problem = checkDraft({ kind: "payment", customer, amount: value && value > 0 ? value : null, method, date }, data, today());
    if (problem || !match || value === null) return setError(problem ?? "Who paid?");
    try {
      recordCustomerPayment({ customerId: match.id, amount: value, method, date });
      const left = owes - value;
      onSaved({ kind: "payment", customer: match.name, amount: value, method, date });
      onDone({ text: `Payment recorded. ${left > 0 ? `${match.name} still owes ${formatNaira(left)}.` : `${match.name} is paid up.`}`, href: routes.customer(match.id) });
    } catch {
      setError(SAVE_FAILED);
    }
  }

  return (
    <Card title="Record this payment?" ask={ask} error={error} onSave={save} onDiscard={onDiscard}>
      <TextField label="Customer" value={customer} onChange={setCustomer} hint={match ? (owes > 0 ? `${match.name} owes ${formatNaira(owes)}. Oldest sale is paid first.` : `${match.name} owes nothing.`) : customer.trim() ? "Not one of your customers" : undefined} />
      <div className="grid grid-cols-2 gap-2">
        <MoneyField label="Amount" value={amount} onChange={setAmount} />
        <SelectField label="Paid by" value={method} options={PAYMENT_METHODS} onChange={(v) => setMethod(v as PaymentMethod)} />
      </div>
      <DateField value={date} onChange={setDate} />
    </Card>
  );
}

// Saved without asking -----------------------------------------------------------------------------------

/**
 * Records a draft straight away (auto-save is on and features/tell/lib/autosave.ts says it's safe).
 * Only sales and expenses are ever auto-saved. Returns what to show and what Undo takes back out.
 */
export function saveDraftNow(draft: Draft, note: string): Done & { undo: Undo } {
  const before = getBizData();
  let done: Done;
  if (draft.kind === "sale") {
    const result = recordSale({ customerName: draft.customer, product: draft.product, totalAmount: draft.total ?? 0, amountPaid: draft.paid, method: draft.method, date: draft.date });
    const customerId = findCustomerByName(getBizData(), result.customerName)?.id;
    done = {
      text: `Sale recorded. ${result.outstanding > 0 ? `${result.customerName} still owes ${formatNaira(result.outstanding)}.` : `${result.customerName} paid in full.`}`,
      href: customerId ? routes.customer(customerId) : undefined,
    };
  } else if (draft.kind === "expense") {
    recordExpense({ category: draft.category, amount: draft.amount ?? 0, description: draft.description, date: draft.date });
    done = { text: `Expense recorded. ${draft.category}: ${formatNaira(draft.amount ?? 0)}.`, href: "/expenses" };
  } else {
    throw new Error("Payments are never saved without asking");
  }
  void rememberShop(note, draft, "auto");
  return { ...done, undo: added(before, getBizData()) };
}

/** A note BizBuddy saved without asking, with Undo. */
export function AutoSavedCard({ done, undo, note }: { done: Done; undo: Undo; note: string }) {
  const [undone, setUndone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function takeBack() {
    try {
      undo.sales.forEach(deleteSale);
      undo.expenses.forEach(deleteExpense);
      setUndone(true);
      void rememberShop(note, null, "undone");
    } catch {
      setError("Couldn't undo it here. Delete it from the sale or expense page.");
    }
  }

  if (undone) return <p className="text-xs text-ink-muted">Undone. Nothing was saved. Send it again the right way.</p>;
  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-800">
      <p className="font-semibold">✓ {done.text}</p>
      <p className="mt-1 text-xs">Saved without asking.</p>
      {error && <p role="alert" className="mt-1 text-xs text-rose-700">{error}</p>}
      <div className="mt-2 flex gap-3">
        {done.href && <Link href={done.href} className="text-xs font-semibold underline">Open</Link>}
        <button type="button" onClick={takeBack} className="text-xs font-semibold underline">Undo</button>
      </div>
    </div>
  );
}

// Small form pieces -------------------------------------------------------------------------------------

function Card({ title, ask, error, onSave, onDiscard, children }: { title: string; ask: string | null; error: string | null; onSave: () => void; onDiscard: () => void; children: ReactNode }) {
  return (
    <div className="space-y-2.5 rounded-xl border border-stone-200 bg-stone-50 p-3">
      <p className="text-sm font-semibold text-ink">{title}</p>
      {ask && <p className="rounded-lg bg-amber-50 px-2.5 py-2 text-xs font-medium text-amber-900">{ask} Fill it in below, then Save.</p>}
      {children}
      {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onDiscard} className="flex-1 rounded-lg bg-white py-2 text-sm font-medium text-ink ring-1 ring-stone-200 hover:bg-stone-100">Don&apos;t save</button>
        <button type="button" onClick={onSave} className="flex-2 rounded-lg bg-brand-700 py-2 text-sm font-semibold text-white hover:bg-brand-800">Save</button>
      </div>
    </div>
  );
}

const fieldClass = "w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-200";

function Labeled({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-muted">{label}</span>
      {children}
      {hint && <span className="mt-0.5 block text-xs text-ink-muted">{hint}</span>}
    </label>
  );
}

function TextField({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <Labeled label={label} hint={hint}>
      <input value={value} onChange={(e) => onChange(e.target.value)} className={fieldClass} />
    </Labeled>
  );
}

function MoneyField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Labeled label={label}>
      <span className="relative block">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-muted">₦</span>
        <input inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} placeholder="0" className={`${fieldClass} pl-7`} />
      </span>
    </Labeled>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (v: string) => void }) {
  return (
    <Labeled label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={fieldClass}>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </Labeled>
  );
}

function DateField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Labeled label="Date">
      <input type="date" value={value} max={today()} onChange={(e) => onChange(e.target.value)} className={fieldClass} />
    </Labeled>
  );
}
