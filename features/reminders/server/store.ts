// Server only: reminders on Supabase, with the secret key (migration 0006). Every query that a person
// triggers is limited to their own shop; the scheduler's queries are the only ones across shops.

import { db } from "@/features/whatsapp/server/books";
import type { Reminder } from "../lib/when";

type Row = { id: string; business_id: string; phone: string; text: string; due_at: string };
const toReminder = (row: Row): Reminder => ({ id: row.id, text: row.text, dueAt: row.due_at });

export async function addReminder(businessId: string, phone: string, text: string, due: Date): Promise<Reminder> {
  const { data, error } = await db()
    .from("reminders")
    .insert({ business_id: businessId, phone, text: text.trim().slice(0, 200), due_at: due.toISOString() })
    .select("id, business_id, phone, text, due_at")
    .single();
  if (error) throw error;
  return toReminder(data as Row);
}

/** Reminders still to go out, soonest first. */
export async function upcomingReminders(businessId: string): Promise<Reminder[]> {
  const { data, error } = await db()
    .from("reminders")
    .select("id, business_id, phone, text, due_at")
    .eq("business_id", businessId)
    .is("sent_at", null)
    .eq("cancelled", false)
    .eq("done", false)
    .order("due_at")
    .limit(50);
  if (error) throw error;
  return (data as Row[]).map(toReminder);
}

/** Cancels one of this shop's reminders. The text of what was cancelled, or null if it wasn't theirs. */
export async function cancelReminder(businessId: string, id: string): Promise<string | null> {
  const { data, error } = await db().from("reminders").update({ cancelled: true }).eq("business_id", businessId).eq("id", id).select("text").maybeSingle();
  if (error) throw error;
  return (data?.text as string | undefined) ?? null;
}

/** Done, or snoozed to a new time (then it goes out again). Null if it isn't this shop's. */
export async function settleReminder(businessId: string, id: string, next: { done: true } | { due: Date }): Promise<string | null> {
  const change = "done" in next ? { done: true } : { due_at: next.due.toISOString(), sent_at: null };
  const { data, error } = await db().from("reminders").update(change).eq("business_id", businessId).eq("id", id).eq("cancelled", false).select("text").maybeSingle();
  if (error) throw error;
  return (data?.text as string | undefined) ?? null;
}

export type DueReminder = Reminder & { businessId: string; phone: string };

/** For the scheduler: reminders whose time has come, across every shop. */
export async function dueReminders(now: Date): Promise<DueReminder[]> {
  const { data, error } = await db()
    .from("reminders")
    .select("id, business_id, phone, text, due_at")
    .is("sent_at", null)
    .eq("cancelled", false)
    .eq("done", false)
    .lte("due_at", now.toISOString())
    .order("due_at")
    .limit(100);
  if (error) throw error;
  return (data as Row[]).map((row) => ({ ...toReminder(row), businessId: row.business_id, phone: row.phone }));
}

/** Marks it sent, only if nobody else did first. False when another run already took it. */
export async function claimReminder(id: string, at: Date): Promise<boolean> {
  const { data, error } = await db().from("reminders").update({ sent_at: at.toISOString() }).eq("id", id).is("sent_at", null).select("id");
  if (error) throw error;
  return (data ?? []).length > 0;
}

/** Puts it back to be sent on the next run (the send failed). */
export async function releaseReminder(id: string): Promise<void> {
  const { error } = await db().from("reminders").update({ sent_at: null }).eq("id", id);
  if (error) throw error;
}

/** Records that this owner just messaged BizBuddy (the 24-hour window starts again). */
export async function noteInbound(phone: string): Promise<void> {
  const { error } = await db().from("whatsapp_chats").upsert({ phone, last_inbound_at: new Date().toISOString() });
  if (error) throw error;
}

export async function lastInbound(phone: string): Promise<Date | null> {
  const { data, error } = await db().from("whatsapp_chats").select("last_inbound_at").eq("phone", phone).maybeSingle();
  if (error) throw error;
  return data?.last_inbound_at ? new Date(data.last_inbound_at as string) : null;
}
