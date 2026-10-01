"use client";

import { useEffect, useState } from "react";
import { cancelReminder, listReminders, ReminderError, setCheckIns, setUnsavedReminder } from "@/features/reminders/lib/client";
import { DEFAULT_CHECK_INS, type CheckInKind, type CheckIns } from "@/features/checkins/lib/checkins";
import { formatWhen, type Reminder } from "@/features/reminders/lib/when";
import type { UnsavedReminder } from "@/features/tell/lib/memory";

const UNSAVED_LABELS: Record<UnsavedReminder, string> = { "30m": "After 30 minutes", "2h": "After 2 hours", never: "Never" };

/** Upcoming reminders (sent on WhatsApp) with Cancel, and when to be reminded about unsaved notes. Signed-in only. */
export function RemindersSection() {
  const [reminders, setReminders] = useState<Reminder[] | null>(null);
  const [unsaved, setUnsaved] = useState<UnsavedReminder>("30m");
  const [checkIns, setCheckInsState] = useState<CheckIns>(DEFAULT_CHECK_INS);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    listReminders()
      .then((result) => {
        if (!live) return;
        setReminders(result.reminders);
        setUnsaved(result.unsavedReminder);
        setCheckInsState(result.checkIns ?? DEFAULT_CHECK_INS);
      })
      .catch((e) => live && setError(e instanceof ReminderError ? e.message : "Couldn't load your reminders."));
    return () => {
      live = false;
    };
  }, []);

  async function cancel(id: string) {
    setError(null);
    try {
      await cancelReminder(id);
      setReminders((current) => current?.filter((r) => r.id !== id) ?? null);
    } catch (e) {
      setError(e instanceof ReminderError ? e.message : "Couldn't cancel it. Try again.");
    }
  }

  async function toggleCheckIn(kind: CheckInKind) {
    const before = checkIns;
    const next = { ...checkIns, [kind]: !checkIns[kind] };
    setCheckInsState(next);
    setError(null);
    try {
      await setCheckIns(next);
    } catch (e) {
      setCheckInsState(before);
      setError(e instanceof ReminderError ? e.message : "Couldn't change that. Try again.");
    }
  }

  async function choose(choice: UnsavedReminder) {
    const before = unsaved;
    setUnsaved(choice);
    setError(null);
    try {
      await setUnsavedReminder(choice);
    } catch (e) {
      setUnsaved(before);
      setError(e instanceof ReminderError ? e.message : "Couldn't change that. Try again.");
    }
  }

  return (
    <section aria-labelledby="settings-reminders" className="rounded-2xl border border-stone-200 bg-white">
      <div className="border-b border-stone-100 px-5 py-4">
        <h2 id="settings-reminders" className="text-sm font-semibold text-ink">Reminders</h2>
        <p className="mt-0.5 text-xs text-ink-muted">Sent to you on WhatsApp. Set one by telling BizBuddy, like “Remind me Friday at 10am to collect money from David”.</p>
      </div>
      <div className="space-y-4 px-5 py-4">
        {reminders === null && !error && <p className="text-sm text-ink-muted">Loading…</p>}
        {reminders?.length === 0 && <p className="text-sm text-ink-muted">No reminders coming up.</p>}
        {reminders && reminders.length > 0 && (
          <ul className="divide-y divide-stone-100">
            {reminders.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate text-sm text-ink">{r.text}</span>
                  <span className="block text-xs text-ink-muted">{formatWhen(r.dueAt)}</span>
                </span>
                <button type="button" onClick={() => void cancel(r.id)} className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50">
                  Cancel
                </button>
              </li>
            ))}
          </ul>
        )}
        <label className="block">
          <span className="block text-sm font-medium text-ink">Remind me about notes I didn&apos;t save or cancel</span>
          <span className="block text-xs text-ink-muted">On WhatsApp, when BizBuddy showed you a note and you didn&apos;t tap Save or Cancel.</span>
          <select value={unsaved} onChange={(e) => void choose(e.target.value as UnsavedReminder)} disabled={reminders === null} className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-ink">
            {(Object.keys(UNSAVED_LABELS) as UnsavedReminder[]).map((choice) => (
              <option key={choice} value={choice}>{UNSAVED_LABELS[choice]}</option>
            ))}
          </select>
        </label>
        <fieldset>
          <legend className="text-sm font-medium text-ink">Check-ins on WhatsApp</legend>
          <label className="mt-2 flex items-start justify-between gap-4">
            <span className="text-xs text-ink-muted">At 7pm on days with nothing recorded: “How was business today?”</span>
            <input type="checkbox" checked={checkIns.evening} disabled={reminders === null} onChange={() => void toggleCheckIn("evening")} className="mt-0.5 size-5 shrink-0 accent-brand-700" aria-label="Evening check-in" />
          </label>
          <label className="mt-2 flex items-start justify-between gap-4">
            <span className="text-xs text-ink-muted">Sunday evening: your week&apos;s sales, money collected, spending, and who owes you.</span>
            <input type="checkbox" checked={checkIns.weekly} disabled={reminders === null} onChange={() => void toggleCheckIn("weekly")} className="mt-0.5 size-5 shrink-0 accent-brand-700" aria-label="Weekly summary" />
          </label>
        </fieldset>
        {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
      </div>
    </section>
  );
}
