// GET /api/tell/autosave: whether BizBuddy saves notes without asking, for the signed-in owner's shop.
// POST { on: boolean }: turns it on or off. Stored in their shop memory (row level security).

import { createClient } from "@supabase/supabase-js";
import { autoSaveFor, setAutoSave } from "@/features/tell/server/memory";

async function signedIn(request: Request): Promise<string | null> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !key) return null;
  const { data, error } = await createClient(url, key, { auth: { persistSession: false } }).auth.getUser(token);
  return error || !data.user ? null : token;
}

export async function GET(request: Request) {
  const token = await signedIn(request);
  if (!token) return Response.json({ error: "Log in first." }, { status: 401 });
  return Response.json({ autoSave: await autoSaveFor(token) });
}

export async function POST(request: Request) {
  const token = await signedIn(request);
  if (!token) return Response.json({ error: "Log in first." }, { status: 401 });
  let body: { on?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }
  if (typeof body.on !== "boolean") return Response.json({ error: "Bad request." }, { status: 400 });
  if (!(await setAutoSave(token, body.on))) return Response.json({ error: "Couldn't change that just now. Try again." }, { status: 502 });
  return Response.json({ autoSave: body.on ? "on" : "declined" });
}
