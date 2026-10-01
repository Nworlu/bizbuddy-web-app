// POST /api/tell: reads a shop owner's note with an AI model (see features/tell/server/interpret.ts)
// and returns structured actions.
//
// Only for signed-in accounts (the Supabase access token goes in the Authorization header), so the
// AI provider's API key can't be spent by strangers. The note itself is not stored here. Notes the
// owner later confirms are remembered for their shop (app/api/tell/learn). Nothing is recorded here:
// the app shows the actions as drafts and saves only what the owner confirms, or, with auto-save on,
// what is safe to save without asking.

import { createClient } from "@supabase/supabase-js";
import { interpret, TellBusyError, TellRefusedError, tellProvider } from "@/features/tell/server/interpret";
import { memoryFor } from "@/features/tell/server/memory";
import { lagosClock } from "@/features/reminders/lib/when";

const MAX_MESSAGE = 600;
const MAX_CUSTOMERS = 300;
const LIMIT = 30; // notes per user
const WINDOW_MS = 10 * 60_000; // per 10 minutes

// Best effort: per server instance, which is enough to stop a runaway loop or casual abuse.
const recent = new Map<string, number[]>();

function reply(status: number, error: string) {
  return Response.json({ error }, { status });
}

async function signedInUser(request: Request): Promise<string | null> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !key) return null;
  const { data, error } = await createClient(url, key, { auth: { persistSession: false } }).auth.getUser(token);
  return error ? null : (data.user?.id ?? null);
}

function withinLimit(userId: string): boolean {
  const now = Date.now();
  const times = (recent.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (times.length >= LIMIT) return false;
  times.push(now);
  recent.set(userId, times);
  return true;
}

export async function POST(request: Request) {
  if (!tellProvider()) return reply(503, "Tell BizBuddy isn't set up on this server yet.");

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const userId = await signedInUser(request);
  if (!userId) return reply(401, "Log in to use Tell BizBuddy.");
  if (!withinLimit(userId)) return reply(429, "That's a lot of notes in a short time. Wait a few minutes, then try again.");

  let body: { message?: unknown; today?: unknown; weekday?: unknown; customers?: unknown };
  try {
    body = await request.json();
  } catch {
    return reply(400, "Bad request.");
  }
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const today = typeof body.today === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.today) ? body.today : null;
  const weekday = typeof body.weekday === "string" ? body.weekday.slice(0, 12) : "";
  const customers = Array.isArray(body.customers)
    ? body.customers.filter((c): c is string => typeof c === "string").map((c) => c.slice(0, 80)).slice(0, MAX_CUSTOMERS)
    : [];
  if (!message) return reply(400, "Type what happened first.");
  if (message.length > MAX_MESSAGE) return reply(400, `Keep it under ${MAX_MESSAGE} characters, or send it in parts.`);
  if (!today) return reply(400, "Bad request.");

  try {
    const { profile, prompt, autoSave } = await memoryFor(token);
    const chatWith = profile ? `The owner is writing in the BizBuddy app. ${profile}` : null;
    const result = await interpret({ message, today, weekday, time: lagosClock(new Date()).time, customers, chatWith, memory: prompt });
    // With auto-save on, the app saves drafts that are safe to (features/tell/lib/autosave.ts) without asking.
    return Response.json({ ...result, autoSave: autoSave === "on" });
  } catch (error) {
    if (error instanceof TellRefusedError) return reply(422, "BizBuddy couldn't read that note. Try saying it another way.");
    if (error instanceof TellBusyError) return reply(503, "BizBuddy is busy right now. Try again in a minute.");
    console.error("Tell BizBuddy: failed", error instanceof Error ? error.message : error);
    return reply(502, "BizBuddy couldn't read that just now. Try again, or record it with the + button.");
  }
}
