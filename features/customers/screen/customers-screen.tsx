"use client";

import Link from "next/link";
import { useState } from "react";
import { customersWithBalances } from "@/shared/lib/finance";
import { formatNaira } from "@/shared/lib/format";
import { useBiz } from "@/features/shell/hooks/use-biz";
import { PlusIcon, SearchIcon } from "@/shared/ui/icons";
import { CustomerAvatar } from "../components/customer-avatar";
import { routes } from "@/shared/lib/routes";

export function CustomersPage() {
  const { data } = useBiz();
  const [query, setQuery] = useState("");

  const rows = customersWithBalances(data);
  const owing = rows.filter((row) => row.balance > 0);
  const totalOwing = owing.reduce((sum, row) => sum + row.balance, 0);

  const needle = query.trim().toLowerCase();
  const digits = query.replace(/\D/g, "");
  const visible = needle
    ? rows.filter((row) => row.customer.name.toLowerCase().includes(needle) || (digits !== "" && row.customer.phone.replace(/\D/g, "").includes(digits)))
    : rows;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-ink">Customers</h1>
        <Link href="/customers/new" className="flex shrink-0 items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-800">
          <PlusIcon className="size-4" />
          Add customer
        </Link>
      </div>

      {rows.length > 0 && (
        <div className="mb-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-stone-200 bg-white p-4">
            <p className="mb-1 text-xs font-medium text-ink-muted">Customers</p>
            <p className="text-lg font-bold tabular-nums text-ink">{rows.length}</p>
          </div>
          <div className="rounded-xl border border-stone-200 bg-white p-4">
            <p className="mb-1 text-xs font-medium text-ink-muted">Still owed to you</p>
            <p className="text-lg font-bold tabular-nums text-amber-800">{formatNaira(totalOwing)}</p>
            <p className="mt-1 text-xs text-ink-muted">{owing.length === 0 ? "Nobody owes you" : `${owing.length} customer${owing.length === 1 ? "" : "s"} owing`}</p>
          </div>
        </div>
      )}

      <div className="relative mb-4">
        <label htmlFor="customer-search" className="sr-only">Search customers</label>
        <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
        <input
          id="customer-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name or phone"
          className="w-full rounded-xl border border-stone-200 bg-white py-2.5 pl-10 pr-4 text-sm text-ink outline-none transition focus:border-brand-700 focus:ring-2 focus:ring-brand-200"
        />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center">
          <h2 className="text-base font-semibold text-ink">No customers yet</h2>
          <p className="mx-auto mt-2 max-w-xs text-sm text-ink-muted">Customers are added when you record a sale, or you can add one now.</p>
          <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
            <Link href="/sales/new" className="rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800">Record a sale</Link>
            <Link href="/customers/new" className="rounded-xl bg-stone-100 px-5 py-2.5 text-sm font-medium text-ink hover:bg-stone-200">Add a customer</Link>
          </div>
        </div>
      ) : visible.length === 0 ? (
        <p className="py-12 text-center text-sm text-ink-muted">No customers match that search.</p>
      ) : (
        <ul className="space-y-2">
          {visible.map(({ customer, balance }) => (
            <li key={customer.id}>
              <Link href={routes.customer(customer.id)} className="flex items-center gap-4 rounded-xl border border-stone-200 bg-white p-4 transition-colors hover:border-stone-300 hover:bg-stone-50">
                <CustomerAvatar name={customer.name} owing={balance > 0} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">{customer.name}</span>
                  {customer.phone && <span className="block truncate text-xs text-ink-muted">{customer.phone}</span>}
                </span>
                <span className="shrink-0 text-right">
                  {balance > 0 ? (
                    <>
                      <span className="block text-sm font-bold tabular-nums text-amber-800">{formatNaira(balance)}</span>
                      <span className="block text-[11px] font-medium text-amber-800">still owes</span>
                    </>
                  ) : (
                    <span className="rounded-full bg-brand-100 px-2.5 py-1 text-[11px] font-semibold text-brand-800">Paid up</span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
