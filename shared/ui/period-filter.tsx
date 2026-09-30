"use client";

import { useId, useState } from "react";
import { customRange, PERIODS, periodRange, today, type Period, type PeriodChoice } from "@/shared/lib/dates";
import { periodPhrase } from "@/shared/lib/format";

/** The chosen period and its date range. Custom starts as this month so far. */
export function usePeriodRange(initial: Period = "month") {
  const [choice, setChoice] = useState<PeriodChoice>(initial);
  const [custom, setCustom] = useState(() => ({ start: periodRange("month").start, end: today() }));
  const range = choice === "custom" ? customRange(custom.start, custom.end) : periodRange(choice);
  return { choice, setChoice, custom, setCustom, range, phrase: periodPhrase(choice, range) };
}

export type PeriodState = ReturnType<typeof usePeriodRange>;

const CHOICES: { key: PeriodChoice; label: string }[] = [...PERIODS, { key: "custom", label: "Custom" }];

/** Today / This Week / This Month / Last Month / Custom. Custom shows From and To dates. Scrolls sideways on narrow phones. */
export function PeriodFilter({ state, className = "" }: { state: PeriodState; className?: string }) {
  const { choice, setChoice, custom, setCustom } = state;
  const id = useId();
  const max = today();

  return (
    <div className={className}>
      <div role="group" aria-label="Time period" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        {CHOICES.map((p) => (
          <button
            key={p.key}
            type="button"
            aria-pressed={choice === p.key}
            onClick={() => setChoice(p.key)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              choice === p.key ? "bg-brand-700 text-white" : "border border-stone-200 bg-white text-ink-muted hover:border-stone-300 hover:text-ink"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {choice === "custom" && (
        <div className="mt-3 grid grid-cols-2 gap-3 rounded-2xl border border-stone-200 bg-white p-3 sm:max-w-md">
          <div>
            <label htmlFor={`${id}-from`} className="mb-1 block text-xs font-medium text-ink-muted">From</label>
            <input
              id={`${id}-from`}
              type="date"
              value={custom.start}
              max={custom.end < max ? custom.end : max}
              onChange={(e) => e.target.value && setCustom({ ...custom, start: e.target.value })}
              className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-200"
            />
          </div>
          <div>
            <label htmlFor={`${id}-to`} className="mb-1 block text-xs font-medium text-ink-muted">To</label>
            <input
              id={`${id}-to`}
              type="date"
              value={custom.end}
              min={custom.start}
              max={max}
              onChange={(e) => e.target.value && setCustom({ ...custom, end: e.target.value })}
              className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-200"
            />
          </div>
        </div>
      )}
    </div>
  );
}
