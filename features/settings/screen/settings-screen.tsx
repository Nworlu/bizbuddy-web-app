"use client";

import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import { resetAll, updateBusiness, useSyncMeta } from "@/shared/lib/store";
import { accountsEnabled } from "@/shared/lib/supabase";
import { showToast } from "@/shared/lib/toast";
import { BUSINESS_TYPES, type BizData, type Business, type BusinessType } from "@/shared/lib/types";
import { useBiz } from "@/features/shell/hooks/use-biz";
import { countryByIso } from "@/shared/lib/countries";
import { formatPhoneField, normalizePhone } from "@/shared/lib/phone";
import { usePhoneField } from "@/shared/lib/use-phone-field";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { PhoneInput } from "@/shared/ui/phone-input";
import { AccountSection } from "../components/account-section";
import { RemindersSection } from "../components/reminders-section";
import { KnowledgeSection } from "../components/knowledge-section";
import { SettingsFrame } from "../components/settings-frame";
import { settingsLinks } from "../content/links";
import { ChevronRightIcon } from "@/shared/ui/icons";

export function SettingsPage() {
  const { data } = useBiz();
  const signedIn = useSyncMeta() !== null;
  const links = settingsLinks({ accounts: accountsEnabled(), signedIn, demo: !!data.demo });

  return (
    <div className="mx-auto max-w-lg px-4 py-6 md:px-8 md:py-8">
      <h1 className="text-2xl font-bold text-ink">Settings</h1>
      <p className="mt-1 text-sm text-ink-muted">Each part is its own page.</p>
      <ul className="mt-5 space-y-3">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="flex items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-white px-5 py-4 hover:bg-stone-50">
              <span>
                <span className="block text-sm font-semibold text-ink">{link.label}</span>
                <span className="mt-0.5 block text-xs text-ink-muted">{link.detail}</span>
              </span>
              <ChevronRightIcon className="size-4 shrink-0 text-ink-muted" />
            </Link>
          </li>
        ))}
      </ul>
      <p className="pt-6 text-center text-xs text-ink-muted">BizBuddy V0.1 · Made for Nigerian small businesses</p>
    </div>
  );
}

export function AccountSettings() {
  const { data, business } = useBiz();
  return (
    <SettingsFrame title="Account">
      {accountsEnabled() && !data.demo ? <AccountSection data={data} business={business} /> : <p className="text-sm text-ink-muted">This shop doesn&apos;t use an account.</p>}
    </SettingsFrame>
  );
}

export function BusinessSettings() {
  const { business } = useBiz();
  return (
    <SettingsFrame title="Business">
      <BusinessSection business={business} />
    </SettingsFrame>
  );
}

export function ReminderSettings() {
  const { data } = useBiz();
  const signedIn = useSyncMeta() !== null;
  return (
    <SettingsFrame title="Reminders">
      {accountsEnabled() && signedIn && !data.demo ? <RemindersSection /> : <p className="text-sm text-ink-muted">Reminders are available once this shop is backed up.</p>}
    </SettingsFrame>
  );
}

export function ShopSettings() {
  const { data } = useBiz();
  const signedIn = useSyncMeta() !== null;
  return (
    <SettingsFrame title="Your shop">
      {accountsEnabled() && signedIn && !data.demo ? <KnowledgeSection /> : <p className="text-sm text-ink-muted">What BizBuddy knows is available once this shop is backed up.</p>}
    </SettingsFrame>
  );
}

export function RecordsSettings() {
  const { data } = useBiz();
  const signedIn = useSyncMeta() !== null;
  return (
    <SettingsFrame title="Records">
      <DataSection data={data} signedIn={signedIn} />
    </SettingsFrame>
  );
}

export function StartOverSettings() {
  const { data, business } = useBiz();
  const signedIn = useSyncMeta() !== null;
  return (
    <SettingsFrame title="Start over">
      {signedIn ? <p className="text-sm text-ink-muted">Log out from Account first. Deleting here would wipe the account&apos;s books.</p> : <DangerSection data={data} business={business} />}
    </SettingsFrame>
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
  const phoneField = usePhoneField(business.phone ?? "");
  const [type, setType] = useState<BusinessType>(business.type);
  const [about, setAbout] = useState(business.about ?? "");
  const [error, setError] = useState<string | null>(null);

  function start() {
    setName(business.name);
    setOwnerName(business.ownerName);
    phoneField.reset(business.phone ?? "");
    setType(business.type);
    setAbout(business.about ?? "");
    setError(null);
    setEditing(true);
  }

  function save(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return setError("Enter your business name.");
    if (!ownerName.trim()) return setError("Enter your name.");
    if (phoneField.national.trim() && !normalizePhone(phoneField.national, phoneField.dialCode)) {
      return setError("Enter a valid phone number for the country you selected, or leave it empty.");
    }
    const phone = phoneField.national.trim() ? formatPhoneField(phoneField.national, countryByIso(phoneField.countryIso)) : "";
    try {
      updateBusiness({ name, ownerName, phone, type, about });
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
          <Row label="What it does" value={business.about || "Not added"} />
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
          <PhoneInput
            id="settings-phone"
            countryIso={phoneField.countryIso}
            onCountryChange={phoneField.setCountry}
            national={phoneField.national}
            onNationalChange={phoneField.setNational}
          />
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
        <Field id="settings-about" label="What does your business do?">
          <textarea id="settings-about" value={about} onChange={(e) => setAbout(e.target.value)} maxLength={300} rows={3} placeholder="e.g. We sell fairly used laptops and phones in Ikeja" aria-describedby="settings-about-hint" className={inputClass} />
          <p id="settings-about-hint" className="mt-1 text-xs text-ink-muted">BizBuddy uses this to understand your notes. Optional.</p>
        </Field>
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={() => setEditing(false)} className="flex-1 rounded-xl bg-stone-100 py-3 text-sm font-medium text-ink hover:bg-stone-200">Cancel</button>
          <button type="submit" className="flex-2 rounded-xl bg-brand-700 py-3 text-sm font-semibold text-white hover:bg-brand-800">Save</button>
        </div>
      </form>
    </Section>
  );
}

function DataSection({ data, signedIn }: { data: BizData; signedIn: boolean }) {
  return (
    <Section
      title="Your records"
      description={signedIn ? "Saved on this phone, so they work offline, and backed up to your account." : "Stored in this browser on this device. Another phone, another browser, or clearing site data won't have them."}
    >
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
