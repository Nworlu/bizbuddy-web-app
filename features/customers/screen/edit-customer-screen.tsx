"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { deleteCustomer, findCustomerByName, updateCustomer } from "@/shared/lib/store";
import { showToast } from "@/shared/lib/toast";
import type { BizData, Customer } from "@/shared/lib/types";
import { useBiz } from "@/features/shell/hooks/use-biz";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { routes } from "@/shared/lib/routes";
import { normalizePhone } from "@/shared/lib/phone";
import { PhoneInput } from "@/shared/ui/phone-input";

/** Route entry: the id comes from ?id= so the page is static and opens offline. Keyed so forms reset between records. */
export function EditCustomerRoute() {
  const id = useSearchParams().get("id") ?? "";
  return <EditCustomerPage key={id} id={id} />;
}

export function EditCustomerPage({ id }: { id: string }) {
  const { data } = useBiz();
  const [deleted, setDeleted] = useState(false);
  const customer = data.customers.find((c) => c.id === id);

  // Just deleted: render nothing while the redirect lands, instead of flashing "not found".
  if (deleted) return null;
  if (!customer) {
    return (
      <div className="mx-auto max-w-lg px-4 py-6 md:px-8">
        <Link href="/customers" className="text-sm font-medium text-ink-muted hover:text-ink">← Back to Customers</Link>
        <p className="py-12 text-center text-sm text-ink-muted">That customer is not in this shop.</p>
      </div>
    );
  }
  return <EditCustomerForm customer={customer} data={data} onDeleted={() => setDeleted(true)} />;
}

function EditCustomerForm({ customer, data, onDeleted }: { customer: Customer; data: BizData; onDeleted: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(customer.phone);
  const [errors, setErrors] = useState<{ name?: string; phone?: string; form?: string }>({});
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const sales = data.sales.filter((s) => s.customerId === customer.id).length;

  function submit(event: FormEvent) {
    event.preventDefault();
    const clash = name.trim() ? findCustomerByName(data, name) : undefined;
    const next = {
      name: !name.trim() ? "Enter the customer's name." : clash && clash.id !== customer.id ? `${clash.name} is already a customer.` : undefined,
      phone: phone.trim() && !normalizePhone(phone) ? "Enter a valid phone number, or leave it empty." : undefined,
    };
    setErrors(next);
    if (next.name || next.phone) return;

    setSaving(true);
    try {
      updateCustomer({ customerId: customer.id, name, phone: phone.trim() ? normalizePhone(phone) ?? phone.trim() : "" });
      showToast("Customer updated.");
      router.push(routes.customer(customer.id));
    } catch {
      setSaving(false);
      setErrors({ form: "This browser couldn't save the changes. Check that site data is allowed, then try again." });
    }
  }

  function remove() {
    try {
      deleteCustomer(customer.id);
      onDeleted();
      showToast(`${customer.name} deleted.`);
      router.push("/customers");
    } catch {
      setDeleteError("This browser couldn't delete the customer. Try again.");
    }
  }

  const fieldClass = (error: boolean) =>
    `w-full rounded-xl border bg-white px-4 py-3 text-sm text-ink outline-none transition focus:ring-2 ${error ? "border-rose-400 focus:ring-rose-200" : "border-stone-200 focus:border-brand-700 focus:ring-brand-200"}`;

  return (
    <div className="mx-auto max-w-lg px-4 py-6 md:px-8 md:py-8">
      <Link href={routes.customer(customer.id)} className="text-sm font-medium text-ink-muted hover:text-ink">← Back to {customer.name}</Link>
      <h1 className="mt-4 text-2xl font-bold text-ink">Edit customer</h1>

      <form onSubmit={submit} className="mt-6 space-y-5 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6" noValidate>
        <div>
          <label htmlFor="edit-customer-name" className="mb-1.5 block text-sm font-medium text-ink">Name</label>
          <input
            id="edit-customer-name"
            value={name}
            onChange={(e) => { setName(e.target.value); setErrors({}); }}
            autoComplete="off"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "edit-customer-name-error" : undefined}
            className={fieldClass(!!errors.name)}
          />
          {errors.name && <p id="edit-customer-name-error" className="mt-1 text-xs text-rose-700">{errors.name}</p>}
        </div>

        <div>
          <label htmlFor="edit-customer-phone" className="mb-1.5 block text-sm font-medium text-ink">
            Phone <span className="font-normal text-ink-muted">(optional)</span>
          </label>
          <PhoneInput
            id="edit-customer-phone"
            value={phone}
            onChange={(value) => { setPhone(value); setErrors({}); }}
            hasError={!!errors.phone}
          />
          {errors.phone && <p id="edit-customer-phone-error" className="mt-1 text-xs text-rose-700">{errors.phone}</p>}
        </div>

        {errors.form && <p role="alert" className="text-sm text-rose-700">{errors.form}</p>}

        <div className="flex gap-2">
          <Link href={routes.customer(customer.id)} className="flex-1 rounded-xl bg-stone-100 py-3.5 text-center text-sm font-medium text-ink hover:bg-stone-200">Cancel</Link>
          <button type="submit" disabled={saving} className="flex-2 rounded-xl bg-brand-700 py-3.5 text-base font-semibold text-white hover:bg-brand-800 disabled:opacity-60">
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>

      <button type="button" onClick={() => { setDeleteError(null); setConfirming(true); }} className="mt-6 w-full rounded-xl py-3 text-sm font-medium text-rose-700 hover:bg-rose-50">
        Delete {customer.name}
      </button>
      {sales > 0 ? (
        <ConfirmDialog open={confirming} title={`${customer.name} can't be deleted yet`} onCancel={() => setConfirming(false)}>
          <p>{customer.name} has {sales} sale{sales === 1 ? "" : "s"}. Deleting the customer would lose them.</p>
          <p>Delete those sales, or move them to another customer with Edit on each sale, then delete {customer.name}.</p>
        </ConfirmDialog>
      ) : (
        <ConfirmDialog open={confirming} title={`Delete ${customer.name}?`} confirmLabel="Delete customer" onConfirm={remove} onCancel={() => setConfirming(false)} error={deleteError}>
          <p>{customer.name} has no sales, so nothing else changes. This can&apos;t be undone.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}
