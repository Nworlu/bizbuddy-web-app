"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { addCustomer, findCustomerByName } from "@/shared/lib/store";
import { showToast } from "@/shared/lib/toast";
import { useBiz } from "@/features/shell/hooks/use-biz";
import { routes } from "@/shared/lib/routes";
import { normalizePhone } from "@/shared/lib/phone";
import { PhoneInput } from "@/shared/ui/phone-input";

export function NewCustomerPage() {
  const { data } = useBiz();
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<{ name?: string; phone?: string; form?: string }>({});
  const [saving, setSaving] = useState(false);

  const existing = name.trim() ? findCustomerByName(data, name) : undefined;

  function submit(event: FormEvent) {
    event.preventDefault();
    const next = {
      name: !name.trim() ? "Enter the customer's name." : existing ? `${existing.name} is already a customer.` : undefined,
      phone: phone.trim() && !normalizePhone(phone) ? "Enter a phone number like 08012345678, or leave it empty." : undefined,
    };
    setErrors(next);
    if (next.name || next.phone) return;

    setSaving(true);
    try {
      const customer = addCustomer({ name, phone: phone.trim() ? normalizePhone(phone) ?? phone.trim() : "" });
      showToast(`${customer.name} added.`);
      router.push(routes.customer(customer.id));
    } catch {
      setSaving(false);
      setErrors({ form: "This browser couldn't save the customer. Check that site data is allowed, then try again." });
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6 md:px-8 md:py-8">
      <Link href="/customers" className="text-sm font-medium text-ink-muted hover:text-ink">← Back to Customers</Link>
      <h1 className="mt-4 text-2xl font-bold text-ink">Add customer</h1>
      <p className="mt-1 text-sm text-ink-muted">You can also add a customer while recording a sale.</p>

      <form onSubmit={submit} className="mt-6 space-y-5 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6" noValidate>
        <div>
          <label htmlFor="new-customer-name" className="mb-1.5 block text-sm font-medium text-ink">Name</label>
          <input
            id="new-customer-name"
            value={name}
            onChange={(event) => { setName(event.target.value); setErrors({}); }}
            placeholder="e.g. Musa Bello"
            autoComplete="off"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "new-customer-name-error" : undefined}
            className={fieldClass(!!errors.name)}
            autoFocus
          />
          {errors.name && <p id="new-customer-name-error" className="mt-1 text-xs text-rose-700">{errors.name}</p>}
          {/* Once saved, the new customer matches their own name; don't flash the warning before the redirect. */}
          {existing && !errors.name && !saving && (
            <p className="mt-1 text-xs text-ink-muted">
              <Link href={routes.customer(existing.id)} className="font-medium text-brand-700 hover:text-brand-800">{existing.name}</Link> is already a customer.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="new-customer-phone" className="mb-1.5 block text-sm font-medium text-ink">
            Phone <span className="font-normal text-ink-muted">(optional)</span>
          </label>
          <PhoneInput
            id="new-customer-phone"
            value={phone}
            onChange={(value) => { setPhone(value); setErrors({}); }}
            hasError={!!errors.phone}
          />
          {errors.phone && <p id="new-customer-phone-error" className="mt-1 text-xs text-rose-700">{errors.phone}</p>}
        </div>

        {errors.form && <p role="alert" className="text-sm text-rose-700">{errors.form}</p>}

        <button type="submit" disabled={saving} className="w-full rounded-xl bg-brand-700 py-3.5 text-base font-semibold text-white transition-colors hover:bg-brand-800 disabled:opacity-60">
          {saving ? "Saving…" : "Add customer"}
        </button>
      </form>
    </div>
  );
}

function fieldClass(error: boolean) {
  return `w-full rounded-xl border bg-white px-4 py-3 text-sm text-ink outline-none transition focus:ring-2 ${error ? "border-rose-400 focus:ring-rose-200" : "border-stone-200 focus:border-brand-700 focus:ring-brand-200"}`;
}
