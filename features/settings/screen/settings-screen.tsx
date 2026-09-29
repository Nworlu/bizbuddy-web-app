"use client";

import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import { resetAll, updateBusiness } from "@/shared/lib/store";
import { showToast } from "@/shared/lib/toast";
import { BUSINESS_TYPES, type BizData, type Business, type BusinessType } from "@/shared/lib/types";
import { useBiz } from "@/features/shell/hooks/use-biz";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";

export function SettingsPage() {
  const { data, business } = useBiz();

  return (
    <div className="mx-auto max-w-lg space-y-5 px-4 py-6 md:px-8 md:py-8">
      <h1 className="text-2xl font-bold text-ink">Settings</h1>
      <BusinessSection business={business} />
      <DataSection data={data} />
      <DangerSection data={data} business={business} />
      <p className="pt-2 text-center text-xs text-ink-muted">BizBuddy V0.1 · Made for Nigerian small businesses</p>
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  const id = `settings-${title.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="rounded-2xl border border-stone-200 bg-white">
      <div className="border-b border-stone-100 px-5 py-4">
        <h2 id={id} className="text-sm font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-ink-muted">{description}</p>}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function BusinessSection({ business }: { business: Business }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(business.name);
  const [ownerName, setOwnerName] = useState(business.ownerName);
  const [phone, setPhone] = useState(business.phone ?? "");
  const [type, setType] = useState<BusinessType>(business.type);
  const [error, setError] = useState<string | null>(null);

  function start() {
    setName(business.name);
    setOwnerName(business.ownerName);
    setPhone(business.phone ?? "");
    setType(business.type);
    setError(null);
    setEditing(true);
  }

  function save(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return setError("Enter your business name.");
    if (!ownerName.trim()) return setError("Enter your name.");
    if (phone.trim() && phone.replace(/\D/g, "").length < 10) return setError("Enter a phone number like 08012345678, or leave it empty.");
    try {
      updateBusiness({ name, ownerName, phone, type });
      showToast("Business details saved.");
      setEditing(false);
    } catch {
      setError("This browser couldn't save your changes. Check that site data is allowed, then try again.");
    }
  }

  if (!editing) {
    return (
      <Section title="Business">
        <dl className="divide-y divide-stone-100">
          <Row label="Business name" value={business.name} />
          <Row label="Your name" value={business.ownerName} />
          <Row label="Phone" value={business.phone || "Not added"} />
          <Row label="Type" value={business.type} />
        </dl>
        <button type="button" onClick={start} className="mt-3 w-full rounded-xl bg-stone-100 py-2.5 text-sm font-medium text-ink hover:bg-stone-200">
          Edit details
        </button>
      </Section>
    );
  }

  return (
    <Section title="Business">
      <form onSubmit={save} className="space-y-4" noValidate>
        <Field id="settings-business-name" label="Business name">
          <input id="settings-business-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="organization" className={inputClass} />
        </Field>
        <Field id="settings-owner-name" label="Your name">
          <input id="settings-owner-name" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} autoComplete="name" className={inputClass} />
        </Field>
        <Field id="settings-phone" label="Phone">
          <input id="settings-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder="e.g. 08012345678" className={inputClass} />
        </Field>
        <fieldset>
          <legend className="mb-1.5 block text-sm font-medium text-ink">Business type</legend>
          <div className="grid grid-cols-2 gap-2">
            {BUSINESS_TYPES.map((item) => (
              <label key={item} className={`cursor-pointer rounded-xl border-2 px-3 py-2 text-center text-sm font-medium has-focus-visible:ring-2 has-focus-visible:ring-brand-200 ${type === item ? "border-brand-700 bg-brand-50 text-brand-800" : "border-stone-200 text-ink-muted hover:border-stone-300"}`}>
                <input type="radio" name="settings-business-type" value={item} checked={type === item} onChange={() => setType(item)} className="sr-only" />
                {item}
              </label>
            ))}
          </div>
        </fieldset>
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={() => setEditing(false)} className="flex-1 rounded-xl bg-stone-100 py-3 text-sm font-medium text-ink hover:bg-stone-200">Cancel</button>
          <button type="submit" className="flex-2 rounded-xl bg-brand-700 py-3 text-sm font-semibold text-white hover:bg-brand-800">Save</button>
        </div>
      </form>
    </Section>
  );
}

function DataSection({ data }: { data: BizData }) {
  return (
    <Section title="Your records" description="Stored in this browser on this device. Another phone, another browser, or clearing site data won't have them.">
      <dl className="divide-y divide-stone-100">
        <Row label="Sales" value={String(data.sales.length)} />
        <Row label="Payments" value={String(data.payments.length)} />
        <Row label="Expenses" value={String(data.expenses.length)} />
        <Row label="Customers" value={String(data.customers.length)} />
      </dl>
    </Section>
  );
}

function DangerSection({ data, business }: { data: BizData; business: Business }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const count = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

  function reset() {
    try {
      resetAll();
      // The shell sees no business and sends the user to /welcome.
    } catch {
      setError("This browser couldn't delete the records. Try again.");
    }
  }

  return (
    <Section title="Start over">
      <div className="space-y-3">
        <Link href="/welcome?demo=1" className="block rounded-xl bg-stone-100 px-4 py-3 hover:bg-stone-200">
          <span className="block text-sm font-medium text-ink">Open the sample shop</span>
          <span className="block text-xs text-ink-muted">Look around Ada&apos;s Fashion. You&apos;ll be asked before your records are replaced.</span>
        </Link>
        <button type="button" onClick={() => { setError(null); setConfirming(true); }} className="block w-full rounded-xl bg-rose-50 px-4 py-3 text-left hover:bg-rose-100">
          <span className="block text-sm font-medium text-rose-700">Delete everything</span>
          <span className="block text-xs text-rose-700/80">Remove {business.name} and all its records from this device.</span>
        </button>
      </div>

      <ConfirmDialog
        open={confirming}
        title={`Delete ${business.name}?`}
        confirmLabel="Delete everything"
        onConfirm={reset}
        onCancel={() => setConfirming(false)}
        error={error}
      >
        <p>
          This deletes {count(data.sales.length, "sale")}, {count(data.payments.length, "payment")}, {count(data.expenses.length, "expense")}, and {count(data.customers.length, "customer")} from this device. It can&apos;t be undone.
        </p>
      </ConfirmDialog>
    </Section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="truncate text-right text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">{label}</label>
      {children}
    </div>
  );
}

const inputClass = "w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-ink outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-200";
