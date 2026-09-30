"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { today } from "@/shared/lib/dates";
import { formatNaira, parseNaira } from "@/shared/lib/format";
import { findCustomerByName, recordSale } from "@/shared/lib/store";
import { showToast } from "@/shared/lib/toast";
import { PAYMENT_METHODS, type PaymentMethod } from "@/shared/lib/types";
import { useBiz } from "@/features/shell/hooks/use-biz";

/** Route entry: ?customer=<id> fills in the customer. Read in the browser so the page stays static and opens offline. */
export function RecordSaleRoute() {
  const customerId = useSearchParams().get("customer") ?? undefined;
  return <RecordSalePage key={customerId ?? ""} customerId={customerId} />;
}

export function RecordSalePage({ customerId }: { customerId?: string } = {}) {
  const { data } = useBiz();
  const router = useRouter();
  const [customer, setCustomer] = useState(() => data.customers.find((c) => c.id === customerId)?.name ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [product, setProduct] = useState("");
  const [total, setTotal] = useState("");
  const [paid, setPaid] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("Cash");
  const [date, setDate] = useState(today());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  function change(field: string, value: string, set: (value: string) => void) {
    set(value);
    if (errors[field] || errors.form) {
      setErrors((current) => {
        const next = { ...current };
        delete next[field];
        delete next.form;
        return next;
      });
    }
  }

  const matches = useMemo(() => {
    const query = customer.trim().toLowerCase();
    if (!query) return [];
    return data.customers.filter((item) => item.name.toLowerCase().includes(query)).slice(0, 6);
  }, [customer, data.customers]);

  const listOpen = open && matches.length > 0;

  function pickCustomer(name: string) {
    change("customer", name, setCustomer);
    setOpen(false);
    setActive(-1);
  }

  const totalNum = parseNaira(total);
  const paidNum = paid.trim() === "" ? 0 : parseNaira(paid);
  const known = customer.trim() !== "" && findCustomerByName(data, customer) !== undefined;
  const outstanding = totalNum !== null && paidNum !== null ? totalNum - paidNum : null;

  function submit(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!customer.trim()) next.customer = "Enter the customer's name.";
    if (!product.trim()) next.product = "Enter what you sold.";
    if (totalNum === null || totalNum <= 0) next.total = "Enter the sale amount in whole naira, like 85000.";
    if (paidNum === null) next.paid = "Enter what they paid in whole naira, or leave it empty.";
    else if (totalNum !== null && paidNum > totalNum) next.paid = "They can't pay more than the sale amount.";
    if (!date) next.date = "Choose the date of the sale.";
    else if (date > today()) next.date = "The sale date can't be in the future.";
    setErrors(next);
    if (Object.keys(next).length > 0 || totalNum === null || paidNum === null) return;

    setSaving(true);
    setOpen(false);
    try {
      const result = recordSale({ customerName: customer, product, totalAmount: totalNum, amountPaid: paidNum, method, date });
      const owing = result.outstanding > 0 ? `${result.customerName} still owes ${formatNaira(result.outstanding)}.` : `${result.customerName} paid in full.`;
      showToast(`Sale recorded. ${owing}`);
      router.push("/dashboard");
    } catch {
      setSaving(false);
      setErrors({ form: "This browser couldn't save the sale. Check that site data is allowed, then try again." });
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6 md:px-8 md:py-8">
      <Link href="/sales" className="text-sm font-medium text-ink-muted hover:text-ink">← Back to Sales</Link>
      <h1 className="mt-4 text-2xl font-bold text-ink">Record Sale</h1>
      <p className="mt-1 text-sm text-ink-muted">What did you sell, and how much has been paid?</p>

      <form onSubmit={submit} className="mt-6 space-y-5 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6" noValidate>
        <div className="relative">
          <label htmlFor="customer" className="mb-1.5 block text-sm font-medium text-ink">Customer</label>
          <input
            id="customer"
            value={customer}
            autoComplete="off"
            role="combobox"
            aria-autocomplete="list"
            placeholder="e.g. David Okafor"
            aria-invalid={!!errors.customer}
            aria-describedby={errors.customer ? "customer-error" : undefined}
            aria-expanded={listOpen}
            aria-controls="customer-matches"
            aria-activedescendant={listOpen && active >= 0 ? `customer-option-${active}` : undefined}
            onChange={(event) => { change("customer", event.target.value, setCustomer); setOpen(true); setActive(-1); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                if (matches.length === 0) return;
                event.preventDefault();
                setOpen(true);
                const step = event.key === "ArrowDown" ? 1 : -1;
                setActive((current) => (current + step + matches.length) % matches.length);
              } else if (event.key === "Enter" && listOpen && active >= 0) {
                // Pick the highlighted customer instead of submitting the form.
                event.preventDefault();
                pickCustomer(matches[active].name);
              } else if (event.key === "Escape" && listOpen) {
                event.preventDefault();
                setOpen(false);
              }
            }}
            className={fieldClass(!!errors.customer)}
          />
          {listOpen && (
            <ul id="customer-matches" role="listbox" aria-label="Existing customers" className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-stone-200 bg-white shadow-lg">
              {matches.map((item, index) => (
                <li
                  key={item.id}
                  id={`customer-option-${index}`}
                  role="option"
                  aria-selected={index === active}
                  // mousedown, not click: it fires before the input loses focus and closes the list.
                  onMouseDown={(event) => { event.preventDefault(); pickCustomer(item.name); }}
                  onMouseEnter={() => setActive(index)}
                  className={`cursor-pointer px-4 py-2.5 text-sm text-ink ${index === active ? "bg-brand-50" : ""}`}
                >
                  {item.name}
                </li>
              ))}
            </ul>
          )}
          {errors.customer && <p id="customer-error" className="mt-1 text-xs text-rose-700">{errors.customer}</p>}
          {customer.trim() && !known && !errors.customer && <p className="mt-1 text-xs text-brand-800">New customer — will be added automatically</p>}
        </div>

        <div>
          <label htmlFor="product" className="mb-1.5 block text-sm font-medium text-ink">Product / Item</label>
          <input id="product" value={product} onChange={(event) => change("product", event.target.value, setProduct)} placeholder="e.g. Sneakers, Ankara Dress..." aria-invalid={!!errors.product} aria-describedby={errors.product ? "product-error" : undefined} className={fieldClass(!!errors.product)} />
          {errors.product && <p id="product-error" className="mt-1 text-xs text-rose-700">{errors.product}</p>}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="total" className="mb-1.5 block text-sm font-medium text-ink">Sale Amount</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-ink-muted">₦</span>
              <input id="total" inputMode="numeric" value={total} onChange={(event) => change("total", event.target.value, setTotal)} placeholder="0" aria-invalid={!!errors.total} aria-describedby={errors.total ? "total-error" : undefined} className={`${fieldClass(!!errors.total)} pl-8`} />
            </div>
            {errors.total && <p id="total-error" className="mt-1 text-xs text-rose-700">{errors.total}</p>}
          </div>
          <div>
            <label htmlFor="paid" className="mb-1.5 block text-sm font-medium text-ink">Amount Paid</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-ink-muted">₦</span>
              <input id="paid" inputMode="numeric" value={paid} onChange={(event) => change("paid", event.target.value, setPaid)} placeholder="0" aria-invalid={!!errors.paid} aria-describedby={errors.paid ? "paid-error" : undefined} className={`${fieldClass(!!errors.paid)} pl-8`} />
            </div>
            {errors.paid && <p id="paid-error" className="mt-1 text-xs text-rose-700">{errors.paid}</p>}
          </div>
        </div>

        {outstanding !== null && outstanding >= 0 && totalNum !== null && totalNum > 0 && (
          <div className={`flex items-center justify-between rounded-xl border p-3 ${outstanding > 0 ? "border-amber-200 bg-amber-50" : "border-brand-200 bg-brand-50"}`}>
            <span className="text-sm font-medium text-ink-muted">Outstanding</span>
            <span className={`text-base font-bold ${outstanding > 0 ? "text-amber-800" : "text-brand-800"}`}>
              {outstanding > 0 ? `${formatNaira(outstanding)} still owing` : `${formatNaira(0)} — Paid in full`}
            </span>
          </div>
        )}

        <fieldset>
          <legend className="mb-1.5 block text-sm font-medium text-ink">Payment Method</legend>
          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_METHODS.map((item) => (
              <label key={item} className={`cursor-pointer rounded-xl border-2 px-3 py-2.5 text-center text-sm font-medium transition-colors ${method === item ? "border-brand-700 bg-brand-50 text-brand-800" : "border-stone-200 bg-white text-ink-muted hover:border-stone-300"}`}>
                <input type="radio" name="method" value={item} checked={method === item} onChange={() => setMethod(item)} className="sr-only" />
                {item}
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="date" className="mb-1.5 block text-sm font-medium text-ink">Date</label>
          <input id="date" type="date" value={date} max={today()} onChange={(event) => change("date", event.target.value, setDate)} aria-invalid={!!errors.date} aria-describedby={errors.date ? "date-error" : undefined} className={fieldClass(!!errors.date)} />
          {errors.date && <p id="date-error" className="mt-1 text-xs text-rose-700">{errors.date}</p>}
        </div>

        {errors.form && <p role="alert" className="text-sm text-rose-700">{errors.form}</p>}

        <button type="submit" disabled={saving} className="w-full rounded-xl bg-brand-700 py-3.5 text-base font-semibold text-white transition-colors hover:bg-brand-800 disabled:opacity-60">
          {saving ? "Recording…" : "Record Sale"}
        </button>
      </form>
    </div>
  );
}

function fieldClass(error: boolean) {
  return `w-full rounded-xl border bg-white px-4 py-3 text-sm text-ink outline-none transition focus:ring-2 ${error ? "border-rose-400 focus:ring-rose-200" : "border-stone-200 focus:border-brand-700 focus:ring-brand-200"}`;
}
