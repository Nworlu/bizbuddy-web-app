"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { createBusiness, hasRecords, loadDemoData, useBizData } from "@/shared/lib/store";
import { BUSINESS_TYPES, type BizData, type BusinessType } from "@/shared/lib/types";
import { Logo } from "@/shared/ui/logo";

type Step = "welcome" | "account" | "business";

const SAVE_FAILED = "This browser couldn't save the sample shop. Check that site data is allowed, then try again.";

export default function WelcomePage() {
  const params = useSearchParams();
  const data = useBizData();

  if (!data) return <WelcomeLoading />;
  // /welcome?demo=1 never loads the sample on its own: it always waits for a tap, and asks first if a shop exists.
  if (params.get("demo") === "1") return <SampleShop data={data} />;
  return <Onboarding data={data} />;
}

export function WelcomeLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface">
      <p role="status" className="text-sm text-ink-muted">{label}</p>
    </main>
  );
}

function SampleShop({ data }: { data: BizData }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const shop = data.business;

  function open() {
    setOpening(true);
    setError(null);
    try {
      loadDemoData();
      router.replace("/dashboard");
    } catch {
      setOpening(false);
      setError(SAVE_FAILED);
    }
  }

  // After loading, the data briefly holds Ada's Fashion before the redirect lands. Don't show the warning for it.
  if (opening) return <WelcomeLoading label="Opening the sample shop…" />;

  const replacing = shop !== null || hasRecords(data);

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex justify-center">
          <Logo size="lg" />
        </div>
        {replacing ? (
          <>
            <h1 className="text-xl font-bold text-ink">Replace {shop?.name ?? "your records"} with the sample shop?</h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              This browser already holds your books: {countLabel(data)}. Opening Ada&apos;s Fashion deletes them from this device. This can&apos;t be undone.
            </p>
            {error && <p role="alert" className="mt-4 text-sm text-rose-700">{error}</p>}
            <Link href="/dashboard" className="mt-6 block w-full rounded-xl bg-brand-700 py-3.5 text-center text-base font-semibold text-white hover:bg-brand-800">
              Keep {shop?.name ?? "my records"}
            </Link>
            <button type="button" onClick={open} className="mt-3 w-full rounded-xl border border-rose-200 bg-rose-50 py-3.5 text-sm font-semibold text-rose-700 hover:bg-rose-100">
              Delete my records and open the sample
            </button>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-ink">Look around a sample shop</h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              Ada&apos;s Fashion has sales, part payments, and expenses already recorded, so you can see how BizBuddy works before you enter your own.
            </p>
            {error && <p role="alert" className="mt-4 text-sm text-rose-700">{error}</p>}
            <button type="button" onClick={open} className="mt-6 w-full rounded-xl bg-brand-700 py-3.5 text-base font-semibold text-white hover:bg-brand-800">
              Open the sample shop
            </button>
            <Link href="/welcome" className="mt-3 block w-full rounded-xl border border-stone-200 py-3.5 text-center text-sm font-medium text-ink hover:bg-stone-50">
              Start my own shop instead
            </Link>
          </>
        )}
      </div>
    </main>
  );
}

function countLabel(data: BizData) {
  const part = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  return [part(data.sales.length, "sale"), part(data.expenses.length, "expense"), part(data.customers.length, "customer")].join(", ");
}

function Onboarding({ data }: { data: BizData }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<BusinessType>("Fashion");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data.business) router.replace("/dashboard");
  }, [data.business, router]);

  if (data.business) return <WelcomeLoading />;

  function openSample() {
    // Records without a shop shouldn't exist, but if they do, send the user through the confirmation.
    if (hasRecords(data)) {
      router.push("/welcome?demo=1");
      return;
    }
    setSaving(true);
    try {
      loadDemoData();
      router.replace("/dashboard");
    } catch {
      setSaving(false);
      setError(SAVE_FAILED);
    }
  }

  function continueAccount(event: FormEvent) {
    event.preventDefault();
    if (!ownerName.trim()) {
      setError("Please enter your name.");
      return;
    }
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setError("Enter a phone number like 08012345678.");
      return;
    }
    setError(null);
    setStep("business");
  }

  function openBooks(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Please enter your business name.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      createBusiness({ name: name.trim(), ownerName: ownerName.trim(), phone: phone.trim(), type });
      router.replace("/dashboard");
    } catch {
      setSaving(false);
      setError("This browser couldn't save your shop. Check that site data is allowed, then try again.");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4 py-10">
      <div className="w-full max-w-md">
        {step === "welcome" && (
          <div className="text-center">
            <div className="mb-6 flex justify-center">
              <Logo size="lg" />
            </div>
            <h1 className="text-2xl font-bold text-ink">Welcome to BizBuddy</h1>
            <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-ink-muted">
              Simple bookkeeping for Nigerian small businesses. Know who paid, who owes you, and how much you&apos;ve made.
            </p>
            <button type="button" onClick={() => setStep("account")} className="mt-8 w-full rounded-xl bg-brand-700 py-3.5 text-base font-semibold text-white transition-colors hover:bg-brand-800">
              Get Started
            </button>
            <button
              type="button"
              onClick={openSample}
              disabled={saving}
              className="mt-3 w-full rounded-xl border border-stone-200 bg-white py-3.5 text-sm font-medium text-ink transition-colors hover:bg-stone-50 disabled:opacity-60"
            >
              {saving ? "Opening the sample shop…" : "Try with demo data"}
            </button>
            {error && <p role="alert" className="mt-4 text-sm text-rose-700">{error}</p>}
            <p className="mt-6 text-xs text-stone-400">Made for Nigerian small businesses</p>
          </div>
        )}

        {step === "account" && (
          <form onSubmit={continueAccount} className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8" noValidate>
            <button type="button" onClick={() => { setError(null); setStep("welcome"); }} className="mb-6 text-sm font-medium text-ink-muted hover:text-ink">
              ← Back
            </button>
            <h1 className="text-xl font-bold text-ink">Tell us about you</h1>
            <p className="mt-1 text-sm text-ink-muted">We&apos;ll personalise your experience</p>
            <div className="mt-6 space-y-4">
              <Field id="owner-name" label="Your name">
                <input id="owner-name" value={ownerName} onChange={(event) => setOwnerName(event.target.value)} placeholder="e.g. Ada" autoComplete="name" className={inputClass} />
              </Field>
              <Field id="phone" label="Phone number">
                <input id="phone" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="e.g. 08012345678" autoComplete="tel" inputMode="tel" className={inputClass} />
              </Field>
            </div>
            {error && <p role="alert" className="mt-4 text-sm text-rose-700">{error}</p>}
            <button type="submit" className="mt-6 w-full rounded-xl bg-brand-700 py-3.5 text-base font-semibold text-white transition-colors hover:bg-brand-800">
              Continue
            </button>
          </form>
        )}

        {step === "business" && (
          <form onSubmit={openBooks} className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8" noValidate>
            <button type="button" onClick={() => { setError(null); setStep("account"); }} className="mb-6 text-sm font-medium text-ink-muted hover:text-ink">
              ← Back
            </button>
            <h1 className="text-xl font-bold text-ink">Your business</h1>
            <p className="mt-1 text-sm text-ink-muted">What&apos;s the name of your business?</p>
            <div className="mt-6 space-y-4">
              <Field id="business-name" label="Business name">
                <input id="business-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Ada's Fashion" autoComplete="organization" className={inputClass} />
              </Field>
              <fieldset>
                <legend className="mb-1.5 block text-sm font-medium text-ink">Business type</legend>
                <div className="grid grid-cols-2 gap-2">
                  {BUSINESS_TYPES.map((item) => (
                    <label key={item} className={`cursor-pointer rounded-xl border-2 px-3 py-2.5 text-center text-sm font-medium transition-colors ${type === item ? "border-brand-700 bg-brand-50 text-brand-800" : "border-stone-200 bg-white text-ink-muted hover:border-stone-300"}`}>
                      <input type="radio" name="business-type" value={item} checked={type === item} onChange={() => setType(item)} className="sr-only" />
                      {item}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
            {error && <p role="alert" className="mt-4 text-sm text-rose-700">{error}</p>}
            <button type="submit" disabled={saving} className="mt-6 w-full rounded-xl bg-brand-700 py-3.5 text-base font-semibold text-white transition-colors hover:bg-brand-800 disabled:opacity-60">
              {saving ? "Saving…" : "Open BizBuddy"}
            </button>
          </form>
        )}
      </div>
    </main>
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

const inputClass = "w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-700 focus:ring-2 focus:ring-brand-200";
