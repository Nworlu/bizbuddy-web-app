"use client";

import { useEffect, useState } from "react";
import { cancelReminder, createReminder, ReminderError } from "../lib/client";
import { formatWhen, lagosClock, lagosToUtc, type Reminder } from "../lib/when";

type State = { kind: "saving" } | { kind: "set"; reminder: Reminder } | { kind: "ask"; error?: string } | { kind: "cancelled" } | { kind: "error"; text: string };

/**
 * A reminder from Tell BizBuddy. When the note said when, it's already being set (`saving`, started once
 * by the screen) and this shows it with Cancel. Otherwise it asks when. Reminders go out on WhatsApp.
 */
export function ReminderCard({ text, saving }: { text: string; saving: Promise<Reminder> | null }) {
  const [state, setState] = useState<State>(saving ? { kind: "saving" } : { kind: "ask" });
  // Read the clock once: today (the earliest day to pick) and tomorrow (the day it starts on).
  const [today] = useState(() => lagosClock(new Date()).date);
  const [date, setDate] = useState(() => lagosClock(new Date(Date.now() + 24 * 3_600_000)).date);
  const [time, setTime] = useState("09:00");

  useEffect(() => {
    if (!saving) return;
    let live = true;
    saving
      .then((reminder) => live && setState({ kind: "set", reminder }))
      .catch((error) => live && setState({ kind: "error", text: error instanceof ReminderError ? error.message : "Couldn't set that reminder. Try again." }));
    return () => {
      live = false;
    };
  }, [saving]);

  async function set() {
    const due = lagosToUtc(date, time);
    if (due.getTime() <= Date.now()) return setState({ kind: "ask", error: "Pick a time in the future." });
    setState({ kind: "saving" });
    try {
      setState({ kind: "set", reminder: await createReminder(text, due) });
    } catch (error) {
      setState({ kind: "ask", error: error instanceof ReminderError ? error.message : "Couldn't set that reminder. Try again." });
    }
  }

  async function cancel(reminder: Reminder) {
    try {
      await cancelReminder(reminder.id);
      setState({ kind: "cancelled" });
    } catch (error) {
      setState({ kind: "error", text: error instanceof ReminderError ? error.message : "Couldn't cancel it. Try from Settings." });
    }
  }

  if (state.kind === "saving") return <p className="text-ink-muted">Setting a reminder…</p>;
  if (state.kind === "cancelled") return <p className="text-xs text-ink-muted">Reminder cancelled.</p>;
  if (state.kind === "error") return <p className="text-rose-700">{state.text}</p>;
  if (state.kind === "set") {
    return (
      <div className="space-y-1">
        <p>
          ⏰ I&apos;ll remind you on WhatsApp <span className="font-semibold">{formatWhen(state.reminder.dueAt)}</span>: {state.reminder.text}
        </p>
        <button type="button" onClick={() => void cancel(state.reminder)} className="text-xs font-semibold text-brand-700 underline">
          Cancel reminder
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-2.5 rounded-xl border border-stone-200 bg-stone-50 p-3">
      <p className="text-sm font-semibold text-ink">When should I remind you?</p>
      <p className="text-sm text-ink">{text}</p>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-ink-muted">
          Day
          <input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-2 py-2 text-sm text-ink" />
        </label>
        <label className="text-xs text-ink-muted">
          Time
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-2 py-2 text-sm text-ink" />
        </label>
      </div>
      {state.error && <p role="alert" className="text-xs text-rose-700">{state.error}</p>}
      <button type="button" onClick={() => void set()} className="w-full rounded-lg bg-brand-700 py-2 text-sm font-semibold text-white hover:bg-brand-800">
        Set reminder
      </button>
    </div>
  );
}
