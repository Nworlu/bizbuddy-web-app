// POST /api/tell/learn: remembers a note the owner confirmed, for their shop only.
// The sale, expense, or payment is already saved in the app. This only keeps how they wrote it,
// so the next note is read the same way. A failed call here does not undo the record.

import { createClient } from "@supabase/supabase-js";
import { rememberConfirmed } from "@/features/tell/server/memory";

async function signedIn(request: Request): Promise<string | null> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !key) return null;
  const { data, error } = await createClient(url, key, { auth: { persistSession: false } }).auth.getUser(token);
  return error ? null : token;
}

export async function POST(request: Request) {
  const token = await signedIn(request);
  if (!token) return Response.json({ error: "Log in to use Tell BizBuddy." }, { status: 401 });

  let body: { note?: unknown; draft?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }
  const note = typeof body.note === "string" ? body.note : "";
  await rememberConfirmed(token, note, body.draft);
  return Response.json({ ok: true });
}
