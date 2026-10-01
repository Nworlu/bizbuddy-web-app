// The signed-in owner's reminders, for Tell BizBuddy and Settings. They go out on WhatsApp.
// GET: upcoming reminders and the unsaved-note setting. POST { text, due }: set one. DELETE ?id=: cancel.
// PATCH { unsavedReminder?, checkIns? }: when to be reminded about unsaved notes; which check-ins to get.
//
// The phone number always comes from the login, never the request, so no one can point a reminder at
// someone else. Writes use the secret key (features/reminders/server/store.ts), limited to this shop.

import { createClient } from "@supabase/supabase-js";
import { addReminder, cancelReminder, upcomingReminders } from "@/features/reminders/server/store";
import { UNSAVED_REMINDERS, type UnsavedReminder } from "@/features/tell/lib/memory";
import { findShop, getMemory, saveMemory } from "@/features/whatsapp/server/books";
import { phoneFromLoginEmail } from "@/shared/lib/phone";

const YEAR_MS = 366 * 24 * 3_600_000;

async function owner(request: Request): Promise<{ phone: string; businessId: string } | null> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !key) return null;
  const { data, error } = await createClient(url, key, { auth: { persistSession: false } }).auth.getUser(token);
  const phone = !error && data.user?.email ? phoneFromLoginEmail(data.user.email) : null;
  if (!phone) return null;
  const businessId = await findShop(phone);
  return businessId ? { phone, businessId } : null;
}

const unauthorized = () => Response.json({ error: "Log in first." }, { status: 401 });
const bad = (error = "Bad request.") => Response.json({ error }, { status: 400 });

async function body(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const value = await request.json();
    return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const who = await owner(request);
  if (!who) return unauthorized();
  const [reminders, memory] = await Promise.all([upcomingReminders(who.businessId), getMemory(who.businessId)]);
  return Response.json({ reminders, unsavedReminder: memory.unsavedReminder, checkIns: memory.checkIns });
}

export async function POST(request: Request) {
  const who = await owner(request);
  if (!who) return unauthorized();
  const input = await body(request);
  const text = typeof input?.text === "string" ? input.text.trim() : "";
  const due = typeof input?.due === "string" ? new Date(input.due) : null;
  if (!text || text.length > 200) return bad("Say what to remind you, in under 200 characters.");
  if (!due || Number.isNaN(due.getTime()) || due.getTime() <= Date.now() || due.getTime() > Date.now() + YEAR_MS) return bad("Pick a time in the future, within a year.");
  return Response.json({ reminder: await addReminder(who.businessId, who.phone, text, due) });
}

export async function DELETE(request: Request) {
  const who = await owner(request);
  if (!who) return unauthorized();
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return bad();
  const text = await cancelReminder(who.businessId, id);
  return text ? Response.json({ ok: true }) : Response.json({ error: "That reminder is already gone." }, { status: 404 });
}

export async function PATCH(request: Request) {
  const who = await owner(request);
  if (!who) return unauthorized();
  const input = await body(request);
  const memory = await getMemory(who.businessId);
  const choice = input?.unsavedReminder as UnsavedReminder | undefined;
  const checkIns = input?.checkIns as { evening?: unknown; weekly?: unknown } | undefined;
  if (choice !== undefined && !UNSAVED_REMINDERS.includes(choice)) return bad();
  if (checkIns !== undefined && (typeof checkIns !== "object" || typeof checkIns?.evening !== "boolean" || typeof checkIns?.weekly !== "boolean")) return bad();
  if (choice === undefined && checkIns === undefined) return bad();
  const next = { ...memory, ...(choice ? { unsavedReminder: choice } : {}), ...(checkIns ? { checkIns: { evening: checkIns.evening as boolean, weekly: checkIns.weekly as boolean } } : {}) };
  await saveMemory(who.businessId, next);
  return Response.json({ unsavedReminder: next.unsavedReminder, checkIns: next.checkIns });
}
