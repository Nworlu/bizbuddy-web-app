"use client";

import { BILLING_LATER, BOOKS, PLANS } from "../content/plans";

export function BillingPage() {
  return (
    <div className="mx-auto max-w-lg space-y-5 px-4 py-6 md:px-8 md:py-8">
      <div>
        <h1 className="text-2xl font-bold text-ink">Billing</h1>
        <p className="mt-1 text-sm text-ink-muted">You&apos;re on {BOOKS.name}. The website stays free. Shop and Counter are coming soon. Counter is the recommended plan.</p>
      </div>

      {PLANS.map((plan) => (
        <section key={plan.name} aria-labelledby={`plan-${plan.name}`} className={`rounded-2xl bg-white ${plan.recommended ? "border-2 border-brand-700" : "border border-stone-200"}`}>
          <div className="flex items-start justify-between gap-4 border-b border-stone-100 px-5 py-4">
            <div>
              <p className={`text-xs font-semibold ${plan.recommended ? "text-brand-700" : plan.comingSoon ? "text-amber-700" : "text-brand-700"}`}>
                {plan.recommended ? "Recommended · Coming soon" : plan.comingSoon ? "Coming soon" : "Current plan"}
              </p>
              <h2 id={`plan-${plan.name}`} className="mt-1 text-lg font-semibold text-ink">
                {plan.name}
              </h2>
              {plan.comingSoon && <p className="mt-1 text-sm text-ink-muted">{plan.summary}</p>}
            </div>
            <p className="text-right">
              <span className="block text-lg font-bold text-ink">{plan.price}</span>
              {plan.cadence && <span className="block text-xs text-ink-muted">{plan.cadence}</span>}
            </p>
          </div>
          <ul className="space-y-2 px-5 py-4 text-sm text-ink">
            {plan.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          {plan.comingSoon && (
            <div className="px-5 pb-5">
              <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">Coming soon. There is no card to enter yet.</p>
            </div>
          )}
        </section>
      ))}

      {BILLING_LATER.map((item) => (
        <section key={item.title} aria-labelledby={`billing-${item.title}`} className="rounded-2xl border border-stone-200 bg-white">
          <div className="flex items-center justify-between gap-4 border-b border-stone-100 px-5 py-4">
            <h2 id={`billing-${item.title}`} className="text-sm font-semibold text-ink">
              {item.title}
            </h2>
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">Coming soon</span>
          </div>
          <p className="px-5 py-4 text-sm text-ink-muted">{item.body}</p>
        </section>
      ))}
    </div>
  );
}
