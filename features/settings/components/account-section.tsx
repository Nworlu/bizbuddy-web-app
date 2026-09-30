"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { syncLabel } from "@/features/shell/components/sync-badge";
import { accountErrorMessage, createAccount, logOut, MIN_PASSWORD } from "@/shared/lib/account";
import { formatDate } from "@/shared/lib/format";
import { displayPhone, normalizePhone } from "@/shared/lib/phone";
import { useSyncMeta } from "@/shared/lib/store";
import { syncNow, useSyncStatus } from "@/shared/lib/sync-runner";
import { showToast } from "@/shared/lib/toast";
import type { BizData, Business } from "@/shared/lib/types";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";

/** Backing up to an account (not signed in yet), or the account's status and log-out (signed in). */
export function AccountSection({ data, business }: { data: BizData; business: Business }) {
  const meta = useSyncMeta();
  if (data.demo) return null;
  return meta ? <SignedIn phone={meta.phone} /> : <BackUp business={business} />;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby="settings-account" className="rounded-2xl border border-stone-200 bg-white">
      <div className="border-b border-stone-100 px-5 py-4">
        <h2 id="settings-account" className="text-sm font-semibold text-ink">{title}</h2>
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function BackUp({ business }: { business: Business }) {
  const [phone, setPhone] = useState(business.phone ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!normalizePhone(phone)) return setError("Enter a Nigerian phone number, like 0803 123 4567.");
    if (password.length < MIN_PASSWORD) return setError(`Choose a password of at least ${MIN_PASSWORD} characters.`);
    setSaving(true);
    setError(null);
    try {
      await createAccount({ phone, password });
      showToast(`Account created. ${business.name} is backing up.`);
    } catch (e) {
      setSaving(false);
      const message = accountErrorMessage(e, "create");
      // Logging in would replace these books, so don't send them there.
      setError(message.startsWith("That phone number already has an account") ? "That phone number already has an account. Use a different number for these books." : message);
    }
  }

  return (
    <Card title="Back up your books">
      <p className="text-sm leading-relaxed text-ink-muted">
        Right now {business.name} lives only on this phone. Create an account to back it up, and to open it on another phone. It keeps working offline.
      </p>
      <form onSubmit={submit} className="mt-4 space-y-3" noValidate>
        <div>
          <label htmlFor="backup-phone" className="mb-1.5 block text-sm font-medium text-ink">Phone number</label>
          <input id="backup-phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 0803 123 4567" className={inputClass} />
        </div>
        <div>
          <label htmlFor="backup-password" className="mb-1.5 block text-sm font-medium text-ink">Choose a password</label>
          <input id="backup-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-describedby="backup-password-hint" className={inputClass} />
          <p id="backup-password-hint" className="mt-1 text-xs text-ink-muted">At least {MIN_PASSWORD} characters. You&apos;ll use it to log in on another phone.</p>
        </div>
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        <button type="submit" disabled={saving} className="w-full rounded-xl bg-brand-700 py-3 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60">
          {saving ? "Creating your account…" : "Create account and back up"}
        </button>
      </form>
    </Card>
  );
}

function SignedIn({ phone }: { phone: string }) {
  const router = useRouter();
  const status = useSyncStatus();
  const [confirming, setConfirming] = useState(false);
  const { text } = syncLabel(status);
  const waiting = status.pending;

  async function confirmLogOut() {
    await logOut();
    setConfirming(false);
    router.replace("/login");
  }

  return (
    <Card title="Account">
      <dl className="divide-y divide-stone-100">
        <div className="flex items-center justify-between gap-4 py-2.5">
          <dt className="text-sm text-ink-muted">Phone</dt>
          <dd className="text-sm font-medium text-ink">{displayPhone(phone)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 py-2.5">
          <dt className="text-sm text-ink-muted">Backup</dt>
          <dd className="text-right text-sm font-medium text-ink">
            {text}
            {status.lastSyncedAt && <span className="block text-xs font-normal text-ink-muted">Last backed up {formatDate(status.lastSyncedAt.slice(0, 10))}, {new Date(status.lastSyncedAt).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" })}</span>}
          </dd>
        </div>
      </dl>
      {status.phase === "needs-login" ? (
        <Link href="/login" className="mt-3 block w-full rounded-xl bg-brand-700 py-3 text-center text-sm font-semibold text-white hover:bg-brand-800">Log in again</Link>
      ) : (
        <button type="button" onClick={() => void syncNow()} disabled={status.phase === "syncing"} className="mt-3 w-full rounded-xl bg-stone-100 py-2.5 text-sm font-medium text-ink hover:bg-stone-200 disabled:opacity-60">
          Back up now
        </button>
      )}
      <button type="button" onClick={() => setConfirming(true)} className="mt-2 w-full rounded-xl py-2.5 text-sm font-medium text-rose-700 hover:bg-rose-50">
        Log out of this phone
      </button>

      <ConfirmDialog
        open={confirming}
        title={waiting > 0 ? "Some changes aren't backed up yet" : "Log out of this phone?"}
        confirmLabel={waiting > 0 ? "Log out and lose them" : "Log out"}
        onConfirm={() => void confirmLogOut()}
        onCancel={() => setConfirming(false)}
      >
        {waiting > 0 ? (
          <>
            <p>{waiting === 1 ? "1 change on this phone hasn't" : `${waiting} changes on this phone haven't`} reached your account. Logging out now deletes {waiting === 1 ? "it" : "them"}.</p>
            <p>Connect to the internet and tap Back up now first.</p>
          </>
        ) : (
          <p>Your books stay in your account. They&apos;re removed from this phone until you log in again.</p>
        )}
      </ConfirmDialog>
    </Card>
  );
}

const inputClass = "w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-700 focus:ring-2 focus:ring-brand-200";
