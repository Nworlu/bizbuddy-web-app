"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { customersOwing, periodSummary, recentActivity, type Activity } from "@/shared/lib/finance";
import { formatDate, formatNaira, greeting } from "@/shared/lib/format";
import { hasRecords } from "@/shared/lib/store";
import { useBiz } from "@/features/shell/hooks/use-biz";
import { ArrowDownIcon, ArrowUpIcon, AskIcon, CheckIcon, ChevronRightIcon, PlusIcon } from "@/shared/ui/icons";
import { PeriodFilter, usePeriodRange } from "@/shared/ui/period-filter";
import { SUGGESTED_NOTES, SUGGESTED_QUESTIONS } from "../content/suggested-questions";
import { useSyncMeta } from "@/shared/lib/store";
import { accountsEnabled } from "@/shared/lib/supabase";
import { routes } from "@/shared/lib/routes";

export function Dashboard() {
  const { data, business } = useBiz();
  const period = usePeriodRange();

  const { range } = period;
  const summary = periodSummary(data, range);
  const owing = customersOwing(data);
  const totalOwing = owing.reduce((s, x) => s + x.balance, 0);
  const activity = recentActivity(data, range);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {greeting()}, {business.ownerName} <span aria-hidden="true">👋</span>
          </h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            {hasRecords(data) ? "Here's what's happening with your business." : "Let's get your business started."}
          </p>
        </div>
        <Link href="/sales/new" className="hidden shrink-0 items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-800 md:flex">
          <PlusIcon className="size-4" />
          New Sale
        </Link>
      </div>

      <PeriodFilter state={period} className="mb-6" />

      <section aria-label="Summary" className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard href="/sales" label="Sales" value={summary.sales} accent="border-t-brand-500" tone="text-brand-700" />
        <KpiCard label="Collected" value={summary.collected} accent="border-t-sky-400" tone="text-sky-700" />
        <KpiCard href="/expenses" label="Expenses" value={summary.expenses} accent="border-t-rose-400" tone="text-rose-700" />
        <KpiCard
          href="/customers"
          label="Customers Owing"
          value={totalOwing}
          accent="border-t-amber-400"
          tone="text-amber-700"
          sub={owing.length === 0 ? "Nobody owes you" : `${owing.length} customer${owing.length === 1 ? "" : "s"} · all time`}
        />
      </section>

      {!hasRecords(data) ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <section aria-labelledby="owing-title" className="rounded-2xl border border-stone-200 bg-white p-5">
            <SectionHeader id="owing-title" title="Customers Owing" href="/customers" />
            {owing.length === 0 ? (
              <p className="flex items-center justify-center gap-2 py-6 text-sm text-ink-muted">
                <CheckIcon className="size-4 text-brand-700" />
                No outstanding balances
              </p>
            ) : (
              <ul className="-mx-2 space-y-1">
                {owing.slice(0, 5).map(({ customer, balance }) => (
                  <li key={customer.id}>
                    <Link href={routes.customer(customer.id)} className="flex items-center justify-between gap-3 rounded-xl p-2 transition-colors hover:bg-stone-50">
                      <span className="flex min-w-0 items-center gap-3">
                        <Avatar name={customer.name} />
                        <span className="truncate text-sm font-medium">{customer.name}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-sm font-semibold text-amber-700">{formatNaira(balance)}</span>
                        <span className="block text-[11px] text-ink-muted">owes you</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="activity-title" className="rounded-2xl border border-stone-200 bg-white p-5">
            <SectionHeader id="activity-title" title="Recent Activity" href="/sales" />
            {activity.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-muted">Nothing recorded {period.phrase}.</p>
            ) : (
              <ul className="space-y-3">
                {activity.map((item) => (
                  <ActivityRow key={`${item.kind}-${item.id}`} item={item} />
                ))}
              </ul>
            )}
          </section>

          <AskCard />
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, accent, tone, sub, href }: { label: string; value: number; accent: string; tone: string; sub?: string; href?: string }) {
  const body = (
    <>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</p>
      <p className={`text-xl font-bold leading-none tabular-nums md:text-2xl ${tone}`}>{formatNaira(value)}</p>
      {sub && <p className="mt-1.5 text-xs text-ink-muted">{sub}</p>}
    </>
  );
  const cls = `block rounded-2xl border border-t-4 border-stone-200 bg-white p-4 ${accent}`;
  return href ? (
    <Link href={href} className={`${cls} transition-shadow hover:shadow-md`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function SectionHeader({ id, title, href }: { id: string; title: string; href: string }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 id={id} className="text-base font-semibold">
        {title}
      </h2>
      <Link href={href} className="flex items-center gap-0.5 text-xs font-medium text-brand-700 hover:text-brand-800">
        View all <ChevronRightIcon className="size-3.5" />
        <span className="sr-only"> {title.toLowerCase()}</span>
      </Link>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-semibold text-amber-800">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function ActivityRow({ item }: { item: Activity }) {
  const incoming = item.kind !== "expense";
  const title = item.kind === "expense" ? item.category : item.customerName;
  const detail = item.kind === "sale" ? item.product : item.kind === "payment" ? "Payment received" : item.description;

  return (
    <li className="flex items-center justify-between gap-3">
      <span className="flex min-w-0 items-center gap-3">
        <span aria-hidden="true" className={`flex size-8 shrink-0 items-center justify-center rounded-full ${incoming ? "bg-brand-100 text-brand-700" : "bg-rose-100 text-rose-700"}`}>
          {incoming ? <ArrowUpIcon className="size-3.5" /> : <ArrowDownIcon className="size-3.5" />}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{title}</span>
          <span className="block truncate text-xs text-ink-muted">
            {detail ? `${detail} · ` : ""}
            {formatDate(item.date)}
          </span>
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className={`block text-sm font-semibold tabular-nums ${incoming ? "text-brand-700" : "text-rose-700"}`}>
          <span className="sr-only">{item.kind === "expense" ? "spent " : item.kind === "sale" ? "sold for " : "received "}</span>
          {incoming ? "+" : "−"}
          {formatNaira(item.amount)}
        </span>
        {item.kind === "sale" && item.balance > 0 && <span className="block text-xs text-amber-700">{formatNaira(item.balance)} owing</span>}
      </span>
    </li>
  );
}

function AskCard() {
  const signedIn = useSyncMeta() !== null;
  const readsNotes = accountsEnabled() && signedIn;
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const ask = (q: string) => router.push(`/ask?q=${encodeURIComponent(q)}`);

  return (
    <section aria-labelledby="ask-title" className="rounded-2xl bg-brand-900 p-5 md:col-span-2">
      <h2 id="ask-title" className="mb-3 flex items-center gap-2 text-base font-semibold text-white">
        <AskIcon className="size-5 text-brand-200" />
        Tell BizBuddy
      </h2>
      <p className="-mt-1.5 mb-3 text-xs text-brand-100">{readsNotes ? "Type what happened, or ask about your books." : "Ask about your sales, expenses, and who owes you."}</p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (question.trim()) ask(question.trim());
        }}
      >
        <label htmlFor="ask-input" className="sr-only">
          {readsNotes ? "Tell BizBuddy what happened" : "Ask a question about your business"}
        </label>
        <input
          id="ask-input"
          type="text"
          placeholder={readsNotes ? "Sold 2 shoes to David for 85k…" : "Who owes me money?"}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-white/40"
        />
        <button type="submit" className="shrink-0 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-brand-800 transition-colors hover:bg-brand-50">
          {readsNotes ? "Send" : "Ask"}
        </button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {(readsNotes ? SUGGESTED_NOTES : SUGGESTED_QUESTIONS).map((q) => (
          <button key={q} type="button" onClick={() => ask(q)} className="rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/90 transition-colors hover:bg-white/20">
            {q}
          </button>
        ))}
      </div>
    </section>
  );
}

function EmptyState() {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-8 text-center">
      <h2 className="mb-2 text-lg font-semibold">No transactions yet</h2>
      <p className="mx-auto mb-6 max-w-sm text-sm text-ink-muted">Record your first sale and your business summary will show up here.</p>
      <div className="flex flex-col justify-center gap-3 sm:flex-row">
        <Link href="/sales/new" className="rounded-xl bg-brand-700 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-800">
          Record your first sale
        </Link>
        <Link href="/expenses/new" className="rounded-xl bg-stone-100 px-6 py-3 text-sm font-medium text-ink transition-colors hover:bg-stone-200">
          Record an expense
        </Link>
      </div>
    </section>
  );
}
