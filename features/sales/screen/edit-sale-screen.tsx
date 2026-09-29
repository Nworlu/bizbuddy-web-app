"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { today } from "@/shared/lib/dates";
import { paidForSale, sharedPaymentsForSale } from "@/shared/lib/finance";
import { formatDate, formatNaira, parseNaira } from "@/shared/lib/format";
import { findCustomerByName, updateSale } from "@/shared/lib/store";
import { showToast } from "@/shared/lib/toast";
import type { BizData, Sale } from "@/shared/lib/types";
import { useBiz } from "@/features/shell/hooks/use-biz";

export function EditSalePage({ id }: { id: string }) {
  const { data } = useBiz();
  const sale = data.sales.find((item) => item.id === id);

  if (!sale) {
    return (
      <div className="mx-auto max-w-lg px-4 py-6 md:px-8">
        <Link href="/sales" className="text-sm font-medium text-ink-muted hover:text-ink">← Back to Sales</Link>
        <p className="py-12 text-center text-sm text-ink-muted">That sale is not in this shop.</p>
      </div>
    );
  }
  return <EditSaleForm sale={sale} data={data} />;
}

function EditSaleForm({ sale, data }: { sale: Sale; data: BizData }) {
  const router = useRouter();
  const currentCustomer = data.customers.find((c) => c.id === sale.customerId);
  const [customer, setCustomer] = useState(currentCustomer?.name ?? "");
  const [product, setProduct] = useState(sale.product);
  const [total, setTotal] = useState(String(sale.totalAmount));
  const [date, setDate] = useState(sale.date);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const paid = paidForSale(sale.id, data.payments);
  const firstPayment = data.payments.filter((p) => p.saleId === sale.id).map((p) => p.date).sort()[0];
  const locked = sharedPaymentsForSale(sale.id, data.payments).length > 0;
  const match = customer.trim() ? findCustomerByName(data, customer) : undefined;
  const movingTo = customer.trim() && match?.id !== sale.customerId;

  function submit(event: FormEvent) {
    event.preventDefault();
    const totalNum = parseNaira(total);
    const next: Record<string, string> = {};
    if (!customer.trim()) next.customer = "Enter the customer's name.";
    else if (movingTo && locked) next.customer = `Part of a split payment also paid other sales for ${currentCustomer?.name ?? "this customer"}, so this sale can't move to someone else. Delete that payment first.`;
    if (!product.trim()) next.product = "Enter what you sold.";
    if (totalNum === null || totalNum <= 0) next.total = "Enter the sale amount in whole naira, like 85000.";
    else if (totalNum < paid) next.total = `${formatNaira(paid)} has already been paid on this sale. The total can't be less than that.`;
    if (!date) next.date = "Choose the date of the sale.";
    else if (date > today()) next.date = "The sale date can't be in the future.";
    else if (firstPayment && date > firstPayment) next.date = `A payment was recorded on ${formatDate(firstPayment)}. The sale date can't be after it.`;
    setErrors(next);
    if (Object.keys(next).length > 0 || totalNum === null) return;

    setSaving(true);
    try {
      updateSale({ saleId: sale.id, customerName: customer, product, totalAmount: totalNum, date });
      showToast("Sale updated.");
      router.push(`/sales/${sale.id}`);
    } catch {
      setSaving(false);
      setErrors({ form: "This browser couldn't save the changes. Check that site data is allowed, then try again." });
    }
  }

  const field = (key: string) => ({
    "aria-invalid": !!errors[key],
    "aria-describedby": errors[key] ? `edit-${key}-error` : undefined,
    className: `w-full rounded-xl border bg-white px-4 py-3 text-sm text-ink outline-none transition focus:ring-2 ${errors[key] ? "border-rose-400 focus:ring-rose-200" : "border-stone-200 focus:border-brand-700 focus:ring-brand-200"}`,
  });
  const error = (key: string) => errors[key] && <p id={`edit-${key}-error`} className="mt-1 text-xs text-rose-700">{errors[key]}</p>;

  return (
    <div className="mx-auto max-w-lg px-4 py-6 md:px-8 md:py-8">
      <Link href={`/sales/${sale.id}`} className="text-sm font-medium text-ink-muted hover:text-ink">← Back to the sale</Link>
      <h1 className="mt-4 text-2xl font-bold text-ink">Edit sale</h1>
      <p className="mt-1 text-sm text-ink-muted">
        {paid > 0 ? `${formatNaira(paid)} has been paid on this sale. To change a payment, delete it on the sale page and record it again.` : "Nothing has been paid on this sale yet."}
      </p>

      <form onSubmit={submit} className="mt-6 space-y-5 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6" noValidate>
        <div>
          <label htmlFor="edit-customer" className="mb-1.5 block text-sm font-medium text-ink">Customer</label>
          <input id="edit-customer" value={customer} onChange={(e) => setCustomer(e.target.value)} autoComplete="off" {...field("customer")} />
          {error("customer")}
          {!errors.customer && movingTo && (
            <p className="mt-1 text-xs text-brand-800">{match ? `The sale and its payments will move to ${match.name}.` : "New customer — will be added, and the sale and its payments move to them."}</p>
          )}
        </div>

        <div>
          <label htmlFor="edit-product" className="mb-1.5 block text-sm font-medium text-ink">Product / Item</label>
          <input id="edit-product" value={product} onChange={(e) => setProduct(e.target.value)} {...field("product")} />
          {error("product")}
        </div>

        <div>
          <label htmlFor="edit-total" className="mb-1.5 block text-sm font-medium text-ink">Sale amount</label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-ink-muted">₦</span>
            <input id="edit-total" inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value)} {...field("total")} className={`${field("total").className} pl-8`} />
          </div>
          {error("total")}
        </div>

        <div>
          <label htmlFor="edit-date" className="mb-1.5 block text-sm font-medium text-ink">Date</label>
          <input id="edit-date" type="date" value={date} max={firstPayment && firstPayment < today() ? firstPayment : today()} onChange={(e) => setDate(e.target.value)} {...field("date")} />
          {error("date")}
        </div>

        {errors.form && <p role="alert" className="text-sm text-rose-700">{errors.form}</p>}

        <div className="flex gap-2">
          <Link href={`/sales/${sale.id}`} className="flex-1 rounded-xl bg-stone-100 py-3.5 text-center text-sm font-medium text-ink hover:bg-stone-200">Cancel</Link>
          <button type="submit" disabled={saving} className="flex-2 rounded-xl bg-brand-700 py-3.5 text-base font-semibold text-white hover:bg-brand-800 disabled:opacity-60">
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
