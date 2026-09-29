"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { today } from "@/shared/lib/dates";
import { formatNaira, parseNaira } from "@/shared/lib/format";
import { recordExpense } from "@/shared/lib/store";
import { showToast } from "@/shared/lib/toast";
import { EXPENSE_CATEGORIES, type ExpenseCategory } from "@/shared/lib/types";

export function RecordExpensePage() {
  const router = useRouter();
  const [category, setCategory] = useState<ExpenseCategory>("Stock");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(today());
  const [errors, setErrors] = useState<{ amount?: string; date?: string; form?: string }>({});
  const [saving, setSaving] = useState(false);

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = parseNaira(amount);
    const next = {
      amount: value === null || value <= 0 ? "Enter what you spent in whole naira, like 4000." : undefined,
      date: !date ? "Choose the date you spent it." : date > today() ? "The date can't be in the future." : undefined,
    };
    setErrors(next);
    if (next.amount || next.date || value === null) return;

    setSaving(true);
    try {
      recordExpense({ category, amount: value, description, date });
      showToast(`Expense recorded. ${category}: ${formatNaira(value)}.`);
      router.push("/dashboard");
    } catch {
      setSaving(false);
      setErrors({ form: "This browser couldn't save the expense. Check that site data is allowed, then try again." });
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6 md:px-8 md:py-8">
      <Link href="/expenses" className="text-sm font-medium text-ink-muted hover:text-ink">← Back to Expenses</Link>
      <h1 className="mt-4 text-2xl font-bold text-ink">Record Expense</h1>
      <p className="mt-1 text-sm text-ink-muted">What did you spend money on?</p>

      <form onSubmit={submit} className="mt-6 space-y-5 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6" noValidate>
        <fieldset>
          <legend className="mb-1.5 block text-sm font-medium text-ink">Category</legend>
          <div className="grid grid-cols-2 gap-2">
            {EXPENSE_CATEGORIES.map((item) => (
              <label key={item} className={`cursor-pointer rounded-xl border-2 px-3 py-2.5 text-center text-sm font-medium transition-colors has-focus-visible:ring-2 has-focus-visible:ring-brand-200 ${category === item ? "border-brand-700 bg-brand-50 text-brand-800" : "border-stone-200 bg-white text-ink-muted hover:border-stone-300"}`}>
                <input type="radio" name="category" value={item} checked={category === item} onChange={() => setCategory(item)} className="sr-only" />
                {item}
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="expense-amount" className="mb-1.5 block text-sm font-medium text-ink">Amount</label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-ink-muted">₦</span>
            <input
              id="expense-amount"
              inputMode="numeric"
              value={amount}
              onChange={(event) => { setAmount(event.target.value); setErrors((e) => ({ ...e, amount: undefined, form: undefined })); }}
              placeholder="0"
              aria-invalid={!!errors.amount}
              aria-describedby={errors.amount ? "expense-amount-error" : undefined}
              className={`${fieldClass(!!errors.amount)} pl-8`}
            />
          </div>
          {errors.amount && <p id="expense-amount-error" className="mt-1 text-xs text-rose-700">{errors.amount}</p>}
        </div>

        <div>
          <label htmlFor="expense-description" className="mb-1.5 block text-sm font-medium text-ink">
            Note <span className="font-normal text-ink-muted">(optional)</span>
          </label>
          <input id="expense-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="e.g. Lagos delivery runs" className={fieldClass(false)} />
        </div>

        <div>
          <label htmlFor="expense-date" className="mb-1.5 block text-sm font-medium text-ink">Date</label>
          <input
            id="expense-date"
            type="date"
            value={date}
            max={today()}
            onChange={(event) => { setDate(event.target.value); setErrors((e) => ({ ...e, date: undefined, form: undefined })); }}
            aria-invalid={!!errors.date}
            aria-describedby={errors.date ? "expense-date-error" : undefined}
            className={fieldClass(!!errors.date)}
          />
          {errors.date && <p id="expense-date-error" className="mt-1 text-xs text-rose-700">{errors.date}</p>}
        </div>

        {errors.form && <p role="alert" className="text-sm text-rose-700">{errors.form}</p>}

        <button type="submit" disabled={saving} className="w-full rounded-xl bg-brand-700 py-3.5 text-base font-semibold text-white transition-colors hover:bg-brand-800 disabled:opacity-60">
          {saving ? "Saving…" : "Save expense"}
        </button>
      </form>
    </div>
  );
}

function fieldClass(error: boolean) {
  return `w-full rounded-xl border bg-white px-4 py-3 text-sm text-ink outline-none transition focus:ring-2 ${error ? "border-rose-400 focus:ring-rose-200" : "border-stone-200 focus:border-brand-700 focus:ring-brand-200"}`;
}
