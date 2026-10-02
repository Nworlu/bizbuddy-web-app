// The Tell BizBuddy chat kept for this shop, and clearing it (and the WhatsApp chat) when the owner asks.
// Confirmed notes stay in shop memory. Nothing here records a sale.

import { clearTellThread, saveTellThread, tellThreadFor } from "@/features/tell/server/thread";
import { parseArchive } from "@/features/whatsapp/lib/thread";
import { clearWhatsAppThread } from "@/features/whatsapp/server/books";
import { normalizePhone } from "@/shared/lib/phone";
import { createClient } from "@supabase/supabase-js";

async function tokenUser(request: Request): Promise<string | null> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !key) return null;
  const { data, error } = await createClient(url, key, { auth: { persistSession: false } }).auth.getUser(token);
  return error ? null : (data.user?.id ?? null);
}

export async function GET(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!(await tokenUser(request))) return Response.json({ error: "Log in again." }, { status: 401 });
  return Response.json({ turns: await tellThreadFor(token) });
}

export async function PUT(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!(await tokenUser(request))) return Response.json({ error: "Log in again." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const turns = parseArchive(body?.turns);
  const saved = await saveTellThread(token, turns);
  return Response.json({ saved });
}

export async function DELETE(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!(await tokenUser(request))) return Response.json({ error: "Log in again." }, { status: 401 });
  const { phone } = await clearTellThread(token);
  const normalized = phone ? normalizePhone(phone) : null;
  if (normalized) await clearWhatsAppThread(normalized).catch(() => undefined);
  return Response.json({ cleared: true });
}
