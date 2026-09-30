"use client";

/**
 * Permission to message this number on WhatsApp. WhatsApp requires it before a business sends the
 * first message; the wording says exactly what will be sent.
 */
export function WhatsAppOptIn({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-stone-200 bg-stone-50 p-3">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-brand-700" />
      <span className="text-sm text-ink">
        Send me a welcome message on WhatsApp
        <span className="block text-xs text-ink-muted">To this number, from BizBuddy. After that you can record sales by texting BizBuddy.</span>
      </span>
    </label>
  );
}
