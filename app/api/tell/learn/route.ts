// POST /api/tell/learn: what the owner did with a draft, for their shop only.
// A saved note is remembered (how they wrote it), and the run of drafts saved unchanged is counted,
// so BizBuddy can offer auto-save. The record is already saved in the app; a failure here undoes nothing.

import { createClient } from "@supabase/supabase-js";
import { REVIEWS, type Review } from "@/features/tell/lib/autosave";
import { reviewNote } from "@/features/tell/server/memory";

async function signedIn(request: Request): Promise<string | null> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !key) return null;
  const { data, error } = await createClient(url, key, { auth: { persistSession: false } }).auth.getUser(token);
  return error || !data.user ? null : token;
}

export async function POST(request: Request) {
  const token = await signedIn(request);
  if (!token) return Response.json({ error: "Log in to use Tell BizBuddy." }, { status: 401 });

  let body: { note?: unknown; draft?: unknown; review?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }
  const note = typeof body.note === "string" ? body.note : "";
  const review: Review = REVIEWS.includes(body.review as Review) ? (body.review as Review) : "saved";
  const offer = await reviewNote(token, note, body.draft, review);
  return Response.json({ ok: true, offer });
}
