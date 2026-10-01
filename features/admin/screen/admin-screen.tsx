"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { AdminOverview } from "../server/overview";
import { Logo } from "@/shared/ui/logo";

type AdminScreenProps =
  | { mode: "disabled" }
  | { mode: "login" }
  | { mode: "ready"; overview: AdminOverview };

export function AdminScreen(props: AdminScreenProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const response = await fetch("/api/admin/login", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setSaving(false);
    if (!response.ok) {
      setError("Wrong password.");
      return;
    }
    setPassword("");
    router.refresh();
  }

  async function logOut() {
    await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-surface px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo size="sm" />
            <div>
              <h1 className="text-xl font-bold text-ink">BizBuddy admin</h1>
              <p className="text-sm text-ink-muted">Operator dashboard — not part of the shop owner app.</p>
            </div>
          </div>
          {props.mode === "ready" && (
            <button type="button" onClick={() => void logOut()} className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-stone-50">
              Log out
            </button>
          )}
        </div>

        {props.mode === "disabled" && (
          <Panel title="Admin isn't configured">
            <p className="text-sm text-ink-muted">
              Set <code className="text-xs">ADMIN_PASSWORD</code> in the server environment, then reload this page.
            </p>
          </Panel>
        )}

        {props.mode === "login" && (
          <Panel title="Sign in">
            <form onSubmit={submit} className="mt-4 max-w-sm space-y-4" noValidate>
              <div>
                <label htmlFor="admin-password" className="mb-1.5 block text-sm font-medium text-ink">
                  Admin password
                </label>
                <input id="admin-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} autoComplete="current-password" />
              </div>
              {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
              <button type="submit" disabled={saving} className="rounded-xl bg-brand-700 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60">
                {saving ? "Checking…" : "Continue"}
              </button>
            </form>
          </Panel>
        )}

        {props.mode === "ready" && (
          <div className="space-y-5">
            <Panel title="Integrations">
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Status label="Supabase accounts" ok={props.overview.integrations.accounts} />
                <Status label="Login mailbox" ok={props.overview.integrations.loginEmail} />
                <Status label="Supabase secret key" ok={props.overview.integrations.supabaseSecret} />
                <Status label="OpenAI" ok={props.overview.integrations.openai} />
                <Status label="WhatsApp Cloud API" ok={props.overview.integrations.whatsapp} />
                <Status label="Cron secret" ok={props.overview.integrations.cron} />
                <Status label="Public app URL" ok={props.overview.integrations.appUrl} />
              </ul>
            </Panel>

            <Panel title="Platform totals">
              {props.overview.counts.businesses === null ? (
                <p className="text-sm text-ink-muted">
                  Counts need <code className="text-xs">SUPABASE_SECRET_KEY</code> and a reachable Supabase project.
                </p>
              ) : (
                <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <Stat label="Shops" value={props.overview.counts.businesses} />
                  <Stat label="Customers" value={props.overview.counts.customers} />
                  <Stat label="Sales rows" value={props.overview.counts.sales} />
                  <Stat label="Expense rows" value={props.overview.counts.expenses} />
                </dl>
              )}
            </Panel>

            {props.overview.recentBusinesses.length > 0 && (
              <Panel title="Recent shops">
                <ul className="divide-y divide-stone-100">
                  {props.overview.recentBusinesses.map((shop) => (
                    <li key={`${shop.name}-${shop.createdAt}`} className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-sm">
                      <span>
                        <span className="font-medium text-ink">{shop.name}</span>
                        <span className="text-ink-muted"> · {shop.ownerName}</span>
                      </span>
                      <span className="text-xs text-ink-muted">{new Date(shop.createdAt).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}

            <p className="text-center text-xs text-ink-muted">
              <Link href="/" className="font-medium text-brand-700 hover:text-brand-800">
                Back to BizBuddy
              </Link>
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Status({ label, ok }: { label: string; ok: boolean }) {
  return (
    <li className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm ${ok ? "bg-emerald-50 text-emerald-900" : "bg-stone-50 text-ink-muted"}`}>
      <span>{label}</span>
      <span className="font-medium">{ok ? "Ready" : "Missing"}</span>
    </li>
  );
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="text-2xl font-bold text-ink">{value ?? "—"}</dd>
    </div>
  );
}

const inputClass = "w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-ink outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-200";
