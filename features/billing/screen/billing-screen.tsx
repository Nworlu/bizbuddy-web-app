"use client";

import { CheckIcon } from "@/shared/ui/icons";
import { BILLING_LATER, BOOKS, PLANS } from "../content/plans";

export function BillingPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-8">
      <h1 className="text-2xl font-bold text-ink">Billing</h1>
      <p className="mt-1 max-w-xl text-sm text-ink-muted">You&apos;re on {BOOKS.name}. The website stays free. Shop and Counter are coming soon. Counter is the recommended plan.</p>

      <div className="mt-6 grid grid-cols-1 items-stretch gap-4 md:grid-cols-3">
        {PLANS.map((plan) => (
          <section
            key={plan.name}
            aria-labelledby={`plan-${plan.name}`}
            className={`flex flex-col rounded-2xl bg-white p-5 ${plan.recommended ? "border-2 border-brand-700 max-md:order-first" : "border border-stone-200"}`}
          >
            <p className={`text-xs font-semibold ${plan.comingSoon && !plan.recommended ? "text-amber-700" : "text-brand-700"}`}>
              {plan.recommended ? "Recommended · Coming soon" : plan.comingSoon ? "Coming soon" : "Current plan"}
            </p>
            <div className="mt-3 flex items-baseline justify-between gap-3">
              <h2 id={`plan-${plan.name}`} className="text-lg font-semibold text-ink">
                {plan.name}
              </h2>
              <p className="text-right">
                <span className="text-lg font-bold text-ink">{plan.price}</span>
                {plan.cadence && <span className="ml-1 text-xs text-ink-muted">{plan.cadence}</span>}
              </p>
            </div>
            <p className="mt-2 text-sm leading-5 text-ink-muted">{plan.summary}</p>
            <ul className="mt-4 space-y-2 text-sm text-ink">
              {plan.points.map((point) => (
                <li key={point} className="flex gap-2">
                  <CheckIcon className={`mt-0.5 size-4 shrink-0 ${plan.recommended ? "text-brand-700" : "text-stone-400"}`} />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="mt-4 text-sm text-ink-muted">There is no card to enter yet. Nothing is charged.</p>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        {BILLING_LATER.map((item) => (
          <section key={item.title} aria-labelledby={`billing-${item.title}`} className="rounded-2xl border border-stone-200 bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 id={`billing-${item.title}`} className="text-sm font-semibold text-ink">
                {item.title}
              </h2>
              <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">Coming soon</span>
            </div>
            <p className="mt-2 text-sm leading-5 text-ink-muted">{item.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
