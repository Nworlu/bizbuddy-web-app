"use client";

import Link from "next/link";
import { useState } from "react";
import { PERIODS, periodRange, type Period } from "@/shared/lib/dates";
import { expenseSummary } from "@/shared/lib/finance";
import { formatDate, formatNaira } from "@/shared/lib/format";
import { useBiz } from "@/features/shell/hooks/use-biz";
import { PlusIcon, SearchIcon } from "@/shared/ui/icons";
import { PeriodFilter } from "@/shared/ui/period-filter";

export function ExpensesPage() {
  const { data } = useBiz();
  const [period, setPeriod] = useState<Period>("month");
  const [query, setQuery] = useState("");

  const { expenses, total, byCategory } = expenseSummary(data, periodRange(period));
  const periodLabel = PERIODS.find((p) => p.key === period)!.label.toLowerCase();
  const needle = query.trim().toLowerCase();
  const visible = needle ? expenses.filter((e) => e.category.toLowerCase().includes(needle) || e.description.toLowerCase().includes(needle)) : expenses;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-ink">Expenses</h1>
        <Link href="/expenses/new" className="flex shrink-0 items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-800">
          <PlusIcon className="size-4" />
          Record expense
        </Link>
      </div>

      {data.expenses.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center">
          <h2 className="text-base font-semibold text-ink">No expenses yet</h2>
          <p className="mx-auto mt-2 max-w-xs text-sm text-ink-muted">Record what you spend on stock, delivery, transport, and rent to see it next to your sales.</p>
          <Link href="/expenses/new" className="mt-5 inline-flex rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800">
            Record an expense
          </Link>
        </div>
      ) : (
        <>
          <PeriodFilter value={period} onChange={setPeriod} className="mb-5" />

          <section aria-label="Spending summary" className="mb-5 rounded-2xl border border-stone-200 bg-white p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Spent {periodLabel}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-rose-700">{formatNaira(total)}</p>
            <p className="mt-0.5 text-xs text-ink-muted">{expenses.length} expense{expenses.length === 1 ? "" : "s"}</p>
            {byCategory.length > 0 && (
              <ul className="mt-4 space-y-2.5 border-t border-stone-100 pt-4">
                {byCategory.map(({ category, amount }) => (
                  <li key={category}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-ink">{category}</span>
                      <span className="font-semibold tabular-nums text-ink">{formatNaira(amount)}</span>
                    </div>
                    <div aria-hidden="true" className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-100">
                      <div className="h-full rounded-full bg-rose-300" style={{ width: `${Math.max(2, (amount / total) * 100)}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="relative mb-4">
            <label htmlFor="expense-search" className="sr-only">Search expenses</label>
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
            <input
              id="expense-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by category or note"
              className="w-full rounded-xl border border-stone-200 bg-white py-2.5 pl-10 pr-4 text-sm text-ink outline-none transition focus:border-brand-700 focus:ring-2 focus:ring-brand-200"
            />
          </div>

          {expenses.length === 0 ? (
            <p className="py-12 text-center text-sm text-ink-muted">No expenses recorded {periodLabel}.</p>
          ) : visible.length === 0 ? (
            <p className="py-12 text-center text-sm text-ink-muted">No expenses match that search.</p>
          ) : (
            <ul className="space-y-2">
              {visible.map((expense) => (
                <li key={expense.id}>
                  <Link href={`/expenses/${expense.id}`} className="flex items-start justify-between gap-3 rounded-xl border border-stone-200 bg-white p-4 transition-colors hover:border-stone-300 hover:bg-stone-50">
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-ink">{expense.category}</span>
                      {expense.description && <span className="mt-0.5 block truncate text-xs text-ink-muted">{expense.description}</span>}
                      <span className="mt-0.5 block text-xs text-ink-muted">{formatDate(expense.date)}</span>
                    </span>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-rose-700">
                      <span className="sr-only">spent </span>−{formatNaira(expense.amount)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
