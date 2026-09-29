"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { today } from "@/shared/lib/dates";
import { allocatePayment, customerHistory, customerTotals, owedOn, type CustomerEvent } from "@/shared/lib/finance";
import { formatDate, formatNaira, parseNaira } from "@/shared/lib/format";
import { recordCustomerPayment } from "@/shared/lib/store";
import { showToast } from "@/shared/lib/toast";
import { PAYMENT_METHODS, type BizData, type Customer, type PaymentMethod } from "@/shared/lib/types";
import { useBiz } from "@/features/shell/hooks/use-biz";
import { DeletePaymentButton } from "@/shared/ui/delete-payment-button";
import { CustomerAvatar } from "../components/customer-avatar";

export function CustomerDetailsPage({ id }: { id: string }) {
  const { data } = useBiz();
  const customer = data.customers.find((item) => item.id === id);

  if (!customer) {
    return (
      <div className="mx-auto max-w-lg px-4 py-6 md:px-8">
        <Link href="/customers" className="text-sm font-medium text-ink-muted hover:text-ink">← Back to Customers</Link>
        <p className="py-12 text-center text-sm text-ink-muted">That customer is not in this shop.</p>
      </div>
    );
  }

  const { totalSales, totalPaid, balance } = customerTotals(customer.id, data);
  const history = customerHistory(customer.id, data);

  return (
    <div className="mx-auto max-w-lg px-4 py-6 md:px-8 md:py-8">
      <Link href="/customers" className="text-sm font-medium text-ink-muted hover:text-ink">← Back to Customers</Link>

      <div className="mt-4 mb-6 flex items-center gap-4">
        <CustomerAvatar name={customer.name} owing={balance > 0} size="lg" />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold text-ink">{customer.name}</h1>
          {customer.phone ? (
            <a href={`tel:${customer.phone.replace(/[^\d+]/g, "")}`} className="text-sm text-brand-700 hover:text-brand-800">{customer.phone}</a>
          ) : (
            <p className="text-sm text-ink-muted">No phone number</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Bought" value={formatNaira(totalSales)} />
        <Stat label="Paid" value={formatNaira(totalPaid)} />
        <div className={`rounded-xl border p-3 text-center ${balance > 0 ? "border-amber-200 bg-amber-50" : "border-brand-200 bg-brand-50"}`}>
          <p className="mb-1 text-[11px] font-medium text-ink-muted">Still owes</p>
          <p className={`text-sm font-bold tabular-nums ${balance > 0 ? "text-amber-800" : "text-brand-800"}`}>{formatNaira(balance)}</p>
        </div>
      </div>

      {balance > 0 ? (
        <PaymentForm customer={customer} data={data} />
      ) : history.length > 0 ? (
        <p className="mt-4 rounded-xl border border-brand-200 bg-brand-50 p-3 text-center text-sm font-medium text-brand-800">Paid up. {customer.name} owes you nothing.</p>
      ) : null}

      <Link href="/sales/new" className="mt-3 block w-full rounded-xl bg-stone-100 py-3 text-center text-sm font-medium text-ink hover:bg-stone-200">
        Record a sale
      </Link>

      <section className="mt-6" aria-labelledby="history-title">
        <h2 id="history-title" className="mb-3 text-base font-semibold text-ink">History</h2>
        {history.length === 0 ? (
          <p className="rounded-xl border border-stone-200 bg-white p-6 text-center text-sm text-ink-muted">No sales yet. Record a sale and choose {customer.name} as the customer.</p>
        ) : (
          <ul className="space-y-2">
            {history.map((event) => (
              <HistoryRow key={`${event.kind}-${event.id}`} event={event} data={data} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function PaymentForm({ customer, data }: { customer: Customer; data: BizData }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("Cash");
  const [date, setDate] = useState(today());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const owed = date && date <= today() ? owedOn(customer.id, data, date) : 0;
  const value = parseNaira(amount);
  const balance = customerTotals(customer.id, data).balance;
  const preview = value && value > 0 && value <= owed ? allocatePayment(customer.id, value, date, data) : null;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-4 w-full rounded-xl bg-brand-700 py-3.5 text-base font-semibold text-white hover:bg-brand-800">
        Record payment
      </button>
    );
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!date || date > today()) {
      setError("The payment date can't be in the future.");
      return;
    }
    if (value === null || value <= 0) {
      setError("Enter how much they paid in whole naira, like 5000.");
      return;
    }
    if (owed === 0) {
      setError(`${customer.name} didn't owe anything on ${formatDate(date)}. Check the date.`);
      return;
    }
    if (value > owed) {
      setError(`${customer.name} owed ${formatNaira(owed)} on ${formatDate(date)}. The payment can't be more than that.`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      recordCustomerPayment({ customerId: customer.id, amount: value, method, date });
      const left = balance - value;
      showToast(`Payment recorded. ${left > 0 ? `${customer.name} still owes ${formatNaira(left)}.` : `${customer.name} is paid up.`}`);
      setAmount("");
      setOpen(false);
    } catch {
      setError("This browser couldn't save the payment. Check that site data is allowed, then try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-4 rounded-2xl border border-stone-200 bg-white p-4" noValidate>
      <div>
        <h2 className="text-sm font-semibold text-ink">Record payment from {customer.name}</h2>
        <p className="mt-1 text-sm text-ink-muted">It pays off their oldest unpaid sale first.</p>
      </div>

      <div>
        <label htmlFor="customer-payment-amount" className="mb-1.5 block text-sm font-medium text-ink">Amount</label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-ink-muted">₦</span>
          <input
            id="customer-payment-amount"
            inputMode="numeric"
            value={amount}
            onChange={(event) => { setAmount(event.target.value); setError(null); }}
            placeholder="0"
            aria-invalid={!!error}
            aria-describedby={error ? "customer-payment-error" : preview ? "customer-payment-preview" : undefined}
            className="w-full rounded-xl border border-stone-200 bg-white py-3 pl-8 pr-4 text-sm text-ink outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-200"
          />
        </div>
        <button type="button" onClick={() => { setAmount(String(owed)); setError(null); }} className="mt-1.5 text-xs font-medium text-brand-700 hover:text-brand-800">
          Fill in the full {formatNaira(owed)}
        </button>
      </div>

      {preview && (
        <div id="customer-payment-preview" className="rounded-xl bg-stone-50 p-3 text-sm">
          <p className="mb-1.5 text-xs font-medium text-ink-muted">This payment goes to</p>
          <ul className="space-y-1">
            {preview.map((part) => (
              <li key={part.sale.id} className="flex justify-between gap-3">
                <span className="truncate text-ink">{part.sale.product} <span className="text-ink-muted">· {formatDate(part.sale.date)}</span></span>
                <span className="shrink-0 font-medium tabular-nums text-ink">
                  {formatNaira(part.amount)}{part.clears ? " · cleared" : ""}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 border-t border-stone-200 pt-2 text-xs text-ink-muted">
            Left to pay after this: <span className="font-semibold text-ink">{formatNaira(balance - (value ?? 0))}</span>
          </p>
        </div>
      )}

      <fieldset>
        <legend className="mb-1.5 block text-sm font-medium text-ink">Payment method</legend>
        <div className="grid grid-cols-2 gap-2">
          {PAYMENT_METHODS.map((item) => (
            <label key={item} className={`cursor-pointer rounded-xl border-2 px-3 py-2.5 text-center text-sm font-medium has-focus-visible:ring-2 has-focus-visible:ring-brand-200 ${method === item ? "border-brand-700 bg-brand-50 text-brand-800" : "border-stone-200 text-ink-muted"}`}>
              <input type="radio" name="customer-payment-method" value={item} checked={method === item} onChange={() => setMethod(item)} className="sr-only" />
              {item}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="customer-payment-date" className="mb-1.5 block text-sm font-medium text-ink">Date</label>
        <input id="customer-payment-date" type="date" value={date} max={today()} onChange={(event) => { setDate(event.target.value); setError(null); }} className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-ink outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-200" />
      </div>

      {error && <p id="customer-payment-error" role="alert" className="text-sm text-rose-700">{error}</p>}

      <div className="flex gap-2">
        <button type="button" onClick={() => { setOpen(false); setError(null); }} className="flex-1 rounded-xl bg-stone-100 py-3.5 text-sm font-medium text-ink hover:bg-stone-200">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="flex-2 rounded-xl bg-brand-700 py-3.5 text-base font-semibold text-white hover:bg-brand-800 disabled:opacity-60">
          {saving ? "Saving…" : "Save payment"}
        </button>
      </div>
    </form>
  );
}

function HistoryRow({ event, data }: { event: CustomerEvent; data: BizData }) {
  if (event.kind === "sale") {
    const { sale, paid, balance } = event;
    return (
      <li>
        <Link href={`/sales/${sale.id}`} className="block rounded-xl border border-stone-200 bg-white p-3.5 transition-colors hover:border-stone-300 hover:bg-stone-50">
          <span className="flex items-start justify-between gap-3">
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-ink">{sale.product}</span>
              <span className="mt-0.5 block text-xs text-ink-muted">Sale · {formatDate(sale.date)}</span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-sm font-bold tabular-nums text-ink">{formatNaira(sale.totalAmount)}</span>
              <span className={`mt-0.5 block text-xs font-medium ${balance > 0 ? "text-amber-800" : "text-brand-800"}`}>
                {balance > 0 ? `${formatNaira(balance)} still owing` : "Paid in full"}
              </span>
              {balance > 0 && paid > 0 && <span className="block text-xs text-ink-muted">Paid {formatNaira(paid)}</span>}
            </span>
          </span>
        </Link>
      </li>
    );
  }

  const { payment } = event;
  const products = new Map(data.sales.map((sale) => [sale.id, sale.product]));
  return (
    <li className="rounded-xl border border-brand-200 bg-brand-50 p-3.5">
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-brand-800">Payment received</span>
          <span className="mt-0.5 block text-xs text-ink-muted">{payment.method} · {formatDate(payment.date)}</span>
          <span className="mt-0.5 block truncate text-xs text-ink-muted">
            For {payment.parts.map((part) => products.get(part.saleId) ?? "a sale").join(", ")}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-sm font-bold tabular-nums text-brand-800">+{formatNaira(payment.amount)}</span>
          <DeletePaymentButton groupId={payment.id} data={data} />
        </span>
      </span>
    </li>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3 text-center">
      <p className="mb-1 text-[11px] font-medium text-ink-muted">{label}</p>
      <p className="text-sm font-bold tabular-nums text-ink">{value}</p>
    </div>
  );
}
