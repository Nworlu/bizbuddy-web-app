"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { paidForSale, paymentGroup, saleBalance, sharedPaymentsForSale } from "@/shared/lib/finance";
import { today } from "@/shared/lib/dates";
import { formatDate, formatNaira, parseNaira } from "@/shared/lib/format";
import { deleteSale, recordPayment } from "@/shared/lib/store";
import { showToast } from "@/shared/lib/toast";
import { PAYMENT_METHODS, type BizData, type PaymentMethod, type Sale } from "@/shared/lib/types";
import { useBiz } from "@/features/shell/hooks/use-biz";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { DeletePaymentButton } from "@/shared/ui/delete-payment-button";
import { routes } from "@/shared/lib/routes";

/** Route entry: the id comes from ?id= so the page is static and opens offline. Keyed so forms reset between records. */
export function SaleDetailsRoute() {
  const id = useSearchParams().get("id") ?? "";
  return <SaleDetailsPage key={id} id={id} />;
}

export function SaleDetailsPage({ id }: { id: string }) {
  const { data } = useBiz();
  const [deleted, setDeleted] = useState(false);
  const sale = data.sales.find((item) => item.id === id);
  const customer = sale ? data.customers.find((item) => item.id === sale.customerId) : undefined;

  // Just deleted: render nothing while the redirect to /sales lands, instead of flashing "not found".
  if (deleted) return null;

  if (!sale) {
    return (
      <div className="mx-auto max-w-lg px-4 py-6 md:px-8">
        <Link href="/sales" className="text-sm font-medium text-ink-muted hover:text-ink">← Back to Sales</Link>
        <p className="py-12 text-center text-sm text-ink-muted">That sale is not in this shop.</p>
      </div>
    );
  }

  const paid = paidForSale(sale.id, data.payments);
  const owing = saleBalance(sale, data.payments);
  const payments = data.payments
    .filter((payment) => payment.saleId === sale.id)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  const customerName = customer?.name ?? "Unknown customer";

  return (
    <div className="mx-auto max-w-lg px-4 py-6 md:px-8 md:py-8">
      <Link href="/sales" className="text-sm font-medium text-ink-muted hover:text-ink">← Back to Sales</Link>

      <div className="mt-4 mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-ink">Sale</h1>
          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${owing === 0 ? "bg-brand-100 text-brand-800" : "bg-amber-100 text-amber-800"}`}>
            {owing === 0 ? "Paid in full" : "Still owing"}
          </span>
        </div>
        <Link href={routes.editSale(sale.id)} className="shrink-0 rounded-xl bg-stone-100 px-4 py-2 text-sm font-medium text-ink hover:bg-stone-200">
          Edit
        </Link>
      </div>

      <div className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
        <Detail label="Customer" value={customerName} />
        <Detail label="Product" value={sale.product} />
        <Detail label="Date" value={formatDate(sale.date)} />
        <div className="space-y-2 p-4">
          <Money label="Sale total" value={formatNaira(sale.totalAmount)} />
          <Money label="Paid" value={formatNaira(paid)} />
          <div className="flex items-center justify-between border-t border-stone-100 pt-2">
            <span className="text-sm font-semibold text-ink">Outstanding</span>
            <span className={`text-sm font-bold tabular-nums ${owing > 0 ? "text-amber-800" : "text-brand-800"}`}>
              {owing > 0 ? `${formatNaira(owing)} still owing` : `${formatNaira(0)} — Paid in full`}
            </span>
          </div>
        </div>
      </div>

      <section className="mt-4 rounded-2xl border border-stone-200 bg-white p-4" aria-labelledby="payments-title">
        <h2 id="payments-title" className="text-sm font-semibold text-ink">Payments</h2>
        {payments.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">Nothing has been paid on this sale.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {payments.map((payment) => {
              const group = paymentGroup(payment.batchId ?? payment.id, data.payments);
              const groupTotal = group.reduce((sum, p) => sum + p.amount, 0);
              return (
                <li key={payment.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 text-ink-muted">
                    {formatDate(payment.date)} · {payment.method}
                    {group.length > 1 && <span className="block text-xs">Part of a {formatNaira(groupTotal)} payment</span>}
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <span className="font-semibold tabular-nums text-brand-800">{formatNaira(payment.amount)}</span>
                    <DeletePaymentButton groupId={payment.batchId ?? payment.id} data={data} />
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {owing > 0 && <PaymentForm saleId={sale.id} owing={owing} customerName={customerName} />}

      {customer && (
        <Link href={routes.customer(customer.id)} className="mt-3 block w-full rounded-xl bg-stone-100 py-3 text-center text-sm font-medium text-ink hover:bg-stone-200">
          View {customerName}
        </Link>
      )}

      <DeleteSale sale={sale} data={data} customerName={customerName} onDeleted={() => setDeleted(true)} />
    </div>
  );
}

function DeleteSale({ sale, data, customerName, onDeleted }: { sale: Sale; data: BizData; customerName: string; onDeleted: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const own = data.payments.filter((p) => p.saleId === sale.id);
  const paid = own.reduce((sum, p) => sum + p.amount, 0);
  const shared = sharedPaymentsForSale(sale.id, data.payments);
  const products = new Map(data.sales.map((s) => [s.id, s.product]));

  function confirm() {
    try {
      deleteSale(sale.id);
      onDeleted();
      showToast("Sale deleted.");
      router.push("/sales");
    } catch {
      setError("This browser couldn't delete the sale. Try again.");
    }
  }

  return (
    <>
      <button type="button" onClick={() => { setError(null); setOpen(true); }} className="mt-6 w-full rounded-xl py-3 text-sm font-medium text-rose-700 hover:bg-rose-50">
        Delete this sale
      </button>
      {shared.length > 0 ? (
        <ConfirmDialog open={open} title="This sale can't be deleted yet" onCancel={() => setOpen(false)}>
          {shared.map((group) => (
            <p key={group.id}>
              A {formatNaira(group.amount)} payment on {formatDate(group.date)} paid this sale and{" "}
              {group.parts.filter((part) => part.saleId !== sale.id).map((part) => products.get(part.saleId) ?? "another sale").join(" and ")}.
            </p>
          ))}
          <p>Delete that payment first (from the payments list above), then delete this sale.</p>
        </ConfirmDialog>
      ) : (
        <ConfirmDialog open={open} title="Delete this sale?" confirmLabel="Delete sale" onConfirm={confirm} onCancel={() => setOpen(false)} error={error}>
          <p>
            This removes the {formatNaira(sale.totalAmount)} sale of {sale.product} to {customerName}
            {own.length > 0 ? `, and the ${formatNaira(paid)} paid on it (${own.length} payment${own.length === 1 ? "" : "s"})` : ""}.
          </p>
          <p>It can&apos;t be undone.</p>
        </ConfirmDialog>
      )}
    </>
  );
}

function PaymentForm({ saleId, owing, customerName }: { saleId: string; owing: number; customerName: string }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("Cash");
  const [date, setDate] = useState(today());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = parseNaira(amount);
    if (value === null || value <= 0) {
      setError("Enter how much they paid in whole naira, like 5000.");
      return;
    }
    if (value > owing) {
      setError(`They still owe ${formatNaira(owing)}. The payment can't be more than that.`);
      return;
    }
    if (!date || date > today()) {
      setError("The payment date can't be in the future.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = recordPayment({ saleId, amount: value, method, date });
      const message = result.outstanding > 0 ? `${customerName} still owes ${formatNaira(result.outstanding)}.` : `${customerName} paid in full.`;
      showToast(`Payment recorded. ${message}`);
      setAmount("");
      setSaving(false);
    } catch {
      setSaving(false);
      setError("This browser couldn't save the payment. Check that site data is allowed, then try again.");
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-4 rounded-2xl border border-stone-200 bg-white p-4" noValidate>
      <h2 className="text-sm font-semibold text-ink">Record payment</h2>
      <p className="text-sm text-ink-muted">{customerName} still owes {formatNaira(owing)}.</p>
      <div>
        <label htmlFor="payment-amount" className="mb-1.5 block text-sm font-medium text-ink">Amount</label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-ink-muted">₦</span>
          <input id="payment-amount" inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0" aria-invalid={!!error} className="w-full rounded-xl border border-stone-200 bg-white py-3 pl-8 pr-4 text-sm text-ink outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-200" />
        </div>
      </div>
      <fieldset>
        <legend className="mb-1.5 block text-sm font-medium text-ink">Payment method</legend>
        <div className="grid grid-cols-2 gap-2">
          {PAYMENT_METHODS.map((item) => (
            <label key={item} className={`cursor-pointer rounded-xl border-2 px-3 py-2.5 text-center text-sm font-medium ${method === item ? "border-brand-700 bg-brand-50 text-brand-800" : "border-stone-200 text-ink-muted"}`}>
              <input type="radio" name="payment-method" value={item} checked={method === item} onChange={() => setMethod(item)} className="sr-only" />
              {item}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="payment-date" className="mb-1.5 block text-sm font-medium text-ink">Date</label>
        <input id="payment-date" type="date" value={date} max={today()} onChange={(event) => setDate(event.target.value)} className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-ink outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-200" />
      </div>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      <button type="submit" disabled={saving} className="w-full rounded-xl bg-brand-700 py-3.5 text-base font-semibold text-white hover:bg-brand-800 disabled:opacity-60">
        {saving ? "Saving…" : "Record payment"}
      </button>
    </form>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5">
      <span className="text-sm text-ink-muted">{label}</span>
      <span className="text-right text-sm font-medium text-ink">{value}</span>
    </div>
  );
}

function Money({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-ink-muted">{label}</span>
      <span className="text-sm font-semibold tabular-nums text-ink">{value}</span>
    </div>
  );
}
