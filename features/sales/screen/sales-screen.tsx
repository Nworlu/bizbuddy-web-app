"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { paidForSale, saleBalance } from "@/shared/lib/finance";
import { formatDate, formatNaira } from "@/shared/lib/format";
import { useBiz } from "@/features/shell/hooks/use-biz";
import { PlusIcon } from "@/shared/ui/icons";

export function SalesPage() {
  const { data } = useBiz();
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const names = new Map(data.customers.map((customer) => [customer.id, customer.name]));
    return data.sales
      .map((sale) => ({
        sale,
        customerName: names.get(sale.customerId) ?? "Unknown customer",
        paid: paidForSale(sale.id, data.payments),
        owing: saleBalance(sale, data.payments),
      }))
      .sort((a, b) => b.sale.date.localeCompare(a.sale.date) || b.sale.createdAt.localeCompare(a.sale.createdAt));
  }, [data.customers, data.payments, data.sales]);

  const needle = query.trim().toLowerCase();
  const visible = needle
    ? rows.filter((row) => row.customerName.toLowerCase().includes(needle) || row.sale.product.toLowerCase().includes(needle))
    : rows;
  const totalSales = visible.reduce((sum, row) => sum + row.sale.totalAmount, 0);
  const totalOwing = visible.reduce((sum, row) => sum + row.owing, 0);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-ink">Sales</h1>
        <Link href="/sales/new" className="flex shrink-0 items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-800">
          <PlusIcon className="size-4" />
          New Sale
        </Link>
      </div>

      {rows.length > 0 && (
        <div className="mb-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-stone-200 bg-white p-4">
            <p className="mb-1 text-xs font-medium text-ink-muted">Total sales</p>
            <p className="text-lg font-bold tabular-nums text-brand-800">{formatNaira(totalSales)}</p>
          </div>
          <div className="rounded-xl border border-stone-200 bg-white p-4">
            <p className="mb-1 text-xs font-medium text-ink-muted">Still owing</p>
            <p className="text-lg font-bold tabular-nums text-amber-800">{formatNaira(totalOwing)}</p>
            <p className="mt-1 text-xs text-ink-muted">{visible.length === 0 ? "No matches" : totalOwing > 0 ? "Not paid in full" : "Paid in full"}</p>
          </div>
        </div>
      )}

      <div className="relative mb-4">
        <label htmlFor="sale-search" className="sr-only">Search sales</label>
        <SearchIcon />
        <input
          id="sale-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by customer or product"
          className="w-full rounded-xl border border-stone-200 bg-white py-2.5 pl-10 pr-4 text-sm text-ink outline-none transition focus:border-brand-700 focus:ring-2 focus:ring-brand-200"
        />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center">
          <h2 className="text-base font-semibold text-ink">No sales yet</h2>
          <p className="mx-auto mt-2 max-w-xs text-sm text-ink-muted">Record a sale to see who paid and who still owes you.</p>
          <Link href="/sales/new" className="mt-5 inline-flex rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800">
            Record a sale
          </Link>
        </div>
      ) : visible.length === 0 ? (
        <p className="py-12 text-center text-sm text-ink-muted">No sales match that search.</p>
      ) : (
        <ul className="space-y-2">
          {visible.map((row) => (
            <li key={row.sale.id}>
              <Link href={`/sales/${row.sale.id}`} className="block rounded-xl border border-stone-200 bg-white p-4 transition-colors hover:border-stone-300 hover:bg-stone-50">
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-ink">{row.customerName}</span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${row.owing === 0 ? "bg-brand-100 text-brand-800" : "bg-amber-100 text-amber-800"}`}>
                        {row.owing === 0 ? "Paid" : "Owing"}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-ink-muted">{row.sale.product}</span>
                    <span className="mt-0.5 block text-xs text-stone-400">{formatDate(row.sale.date)}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-bold tabular-nums text-ink">{formatNaira(row.sale.totalAmount)}</span>
                    <span className="mt-0.5 block text-xs text-ink-muted">Paid {formatNaira(row.paid)}</span>
                    <span className={`mt-0.5 block text-xs font-medium ${row.owing > 0 ? "text-amber-800" : "text-brand-800"}`}>
                      {row.owing > 0 ? `${formatNaira(row.owing)} still owing` : "Paid in full"}
                    </span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-stone-400" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  );
}
