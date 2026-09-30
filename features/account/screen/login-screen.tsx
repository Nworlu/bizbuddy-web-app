"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { accountErrorMessage, logIn } from "@/shared/lib/account";
import { displayPhone, normalizePhone } from "@/shared/lib/phone";
import { useBizData, useSyncMeta } from "@/shared/lib/store";
import { accountsEnabled } from "@/shared/lib/supabase";
import { Logo } from "@/shared/ui/logo";

export function LoginPage() {
  const router = useRouter();
  const data = useBizData();
  const meta = useSyncMeta();
  const again = meta !== null; // Signed out on a phone that's still linked: log in again, keep the books.
  const [phone, setPhone] = useState(() => (meta ? displayPhone(meta.phone) : ""));
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Books kept on this phone without an account would be replaced by the account's: refuse, and say why.
  const unbackedShop = !meta && data && !data.demo && data.business ? data.business.name : null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!normalizePhone(phone)) return setError("Enter your phone number, like 0803 123 4567.");
    if (!password) return setError("Enter your password.");
    setSaving(true);
    setError(null);
    try {
      const { hasShop } = await logIn({ phone, password });
      router.replace(hasShop ? "/dashboard" : "/welcome");
    } catch (e) {
      setSaving(false);
      if (e instanceof Error && e.message === "Another account is linked to this phone") {
        setError("This phone is linked to a different account. Log in with that phone number, or log out in Settings first.");
      } else if (e instanceof Error && e.message === "This phone has books that aren't in an account") {
        setError("This phone has books that aren't backed up. Back them up from Settings first, so they aren't lost.");
      } else {
        setError(accountErrorMessage(e, "login"));
      }
    }
  }

  if (!accountsEnabled()) {
    return (
      <Frame>
        <h1 className="text-xl font-bold text-ink">Accounts aren&apos;t available yet</h1>
        <p className="mt-2 text-sm text-ink-muted">Your books are kept on this phone.</p>
        <Link href="/welcome" className="mt-6 block w-full rounded-xl bg-brand-700 py-3.5 text-center text-base font-semibold text-white hover:bg-brand-800">Open BizBuddy</Link>
      </Frame>
    );
  }

  return (
    <Frame>
      <h1 className="text-xl font-bold text-ink">{again ? "Log in again" : "Log in"}</h1>
      <p className="mt-1 text-sm text-ink-muted">
        {again ? "Log in to keep backing up. Nothing on this phone is lost." : "Get your books on this phone. They keep working offline after that."}
      </p>

      {unbackedShop ? (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">This phone already has books for {unbackedShop}.</p>
          <p className="mt-1">They aren&apos;t in an account yet. Logging in would replace them, so back them up first: in Settings, create an account for {unbackedShop}.</p>
          <Link href="/settings" className="mt-3 inline-block font-semibold text-amber-900 underline">Back up {unbackedShop}</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
          <div>
            <label htmlFor="login-phone" className="mb-1.5 block text-sm font-medium text-ink">Phone number</label>
            <input id="login-phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 0803 123 4567" className={inputClass} />
          </div>
          <div>
            <label htmlFor="login-password" className="mb-1.5 block text-sm font-medium text-ink">Password</label>
            <input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
          </div>
          {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
          <button type="submit" disabled={saving} className="w-full rounded-xl bg-brand-700 py-3.5 text-base font-semibold text-white hover:bg-brand-800 disabled:opacity-60">
            {saving ? "Logging in…" : "Log in"}
          </button>
          <p className="text-center text-xs text-ink-muted">Forgot your password? Contact BizBuddy and we&apos;ll help you reset it.</p>
        </form>
      )}

      {!again && (
        <p className="mt-6 text-center text-sm text-ink-muted">
          New to BizBuddy? <Link href="/welcome" className="font-semibold text-brand-700 hover:text-brand-800">Start your books</Link>
        </p>
      )}
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex justify-center">
          <Logo size="lg" />
        </div>
        {children}
      </div>
    </main>
  );
}

const inputClass = "w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-700 focus:ring-2 focus:ring-brand-200";
