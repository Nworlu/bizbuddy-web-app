"use client";

import { PERIODS, type Period } from "@/shared/lib/dates";

/** Today / This Week / This Month / Last Month. Scrolls sideways on narrow phones. */
export function PeriodFilter({ value, onChange, className = "" }: { value: Period; onChange: (period: Period) => void; className?: string }) {
  return (
    <div role="group" aria-label="Time period" className={`-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0 ${className}`}>
      {PERIODS.map((p) => (
        <button
          key={p.key}
          type="button"
          aria-pressed={value === p.key}
          onClick={() => onChange(p.key)}
          className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            value === p.key ? "bg-brand-700 text-white" : "border border-stone-200 bg-white text-ink-muted hover:border-stone-300 hover:text-ink"
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
