"use client";

import { useCallback, useEffect, useState } from "react";
import { displayPhone, normalizePhone } from "@/shared/lib/phone";
import { Logo } from "@/shared/ui/logo";
import type { AdminBusinessRow } from "@/features/admin/server/overview";

type Overview = { total: number; businesses: AdminBusinessRow[] };

export function AdminScreen() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/overview");
      if (res.status === 401) {
        setOverview(null);
        return;
      }
      if (res.status === 503) {
        setError("Admin is not configured. Set ADMIN_SECRET and SUPABASE_SECRET_KEY on the server.");
        return;
      }
      if (!res.ok) throw new Error("Could not load overview.");
      setOverview((await res.json()) as Overview);
    } catch {
      setError("Could not reach the admin API.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setSigningIn(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Could not sign in.");
        return;
      }
      setPassword("");
      await load();
    } finally {
      setSigningIn(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setOverview(null);
  }

  return (
    <main className="min-h-screen bg-surface px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo size="md" />
            <div>
              <h1 className="text-xl font-bold text-ink">BizBuddy admin</h1>
              <p className="text-sm text-ink-muted">Shops backed up to Supabase</p>
            </div>
          </div>
          {overview && (
            <button type="button" onClick={() => void logout()} className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-stone-50">
              Sign out
            </button>
          )}
        </div>

        {loading && !overview && !error && <p className="text-sm text-ink-muted">Loading…</p>}

        {error && (
          <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-900">
            {error}
          </div>
        )}

        {!loading && !overview && !error && (
          <form onSubmit={login} className="mx-auto max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-ink">Sign in</h2>
            <p className="mt-1 text-sm text-ink-muted">Use the admin password from your server environment.</p>
            <label htmlFor="admin-password" className="mt-4 mb-1.5 block text-sm font-medium text-ink">
              Password
            </label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-200"
            />
            <button type="submit" disabled={signingIn || !password} className="mt-4 w-full rounded-xl bg-brand-700 py-3 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60">
              {signingIn ? "Signing in…" : "Continue"}
            </button>
          </form>
        )}

        {overview && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <Stat label="Total shops" value={String(overview.total)} />
              <Stat label="Showing" value={String(overview.businesses.length)} />
              <Stat label="Updated" value={new Date().toLocaleString()} />
            </div>

            <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-stone-100 bg-stone-50 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th className="px-4 py-3">Shop</th>
                    <th className="hidden px-4 py-3 sm:table-cell">Owner</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="hidden px-4 py-3 md:table-cell">Type</th>
                    <th className="hidden px-4 py-3 lg:table-cell">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {overview.businesses.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-ink-muted">
                        No businesses yet.
                      </td>
                    </tr>
                  ) : (
                    overview.businesses.map((row) => (
                      <tr key={row.id} className="hover:bg-stone-50/80">
                        <td className="px-4 py-3 font-medium text-ink">{row.name}</td>
                        <td className="hidden px-4 py-3 text-ink-muted sm:table-cell">{row.owner_name}</td>
                        <td className="px-4 py-3 text-ink-muted">{formatPhoneCell(row.phone)}</td>
                        <td className="hidden px-4 py-3 text-ink-muted md:table-cell">{row.type}</td>
                        <td className="hidden px-4 py-3 text-ink-muted lg:table-cell">{new Date(row.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white px-5 py-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
    </div>
  );
}

function formatPhoneCell(phone: string): string {
  if (!phone.trim()) return "—";
  const normalized = normalizePhone(phone);
  return normalized ? displayPhone(normalized) : phone;
}
