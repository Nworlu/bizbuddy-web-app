// Server only. One shop's memory, stored on their account. The website uses the owner's
// access token, so row level security keeps it to their shop. WhatsApp uses the same table
// with the secret key (features/whatsapp/server/books.ts) when it replies.

import { createClient } from "@supabase/supabase-js";
import { EMPTY_MEMORY, learn, memoryForPrompt, parseMemory, confirmedDraft, type ShopMemory } from "../lib/memory";

function db(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
}

/** What to send with the next note. Empty when this shop has confirmed nothing, or the table isn't there yet. */
export async function memoryPromptFor(token: string): Promise<string | null> {
  const client = db(token);
  if (!client) return null;
  const { data, error } = await client.from("shop_memory").select("memory").maybeSingle();
  if (error || !data) return null;
  return memoryForPrompt(parseMemory(data.memory));
}

/**
 * Remembers a note the owner confirmed, including any corrections they made before saving.
 * Does nothing when the draft isn't complete, or when memory can't be saved. The sale itself
 * is already saved by then; a missed lesson only means the next note isn't taught by this one.
 */
export async function rememberConfirmed(token: string, note: string, draft: unknown): Promise<void> {
  const confirmed = confirmedDraft(draft);
  if (!confirmed) return;
  const client = db(token);
  if (!client) return;
  const { data: shop, error: shopError } = await client.from("businesses").select("id").maybeSingle();
  if (shopError || !shop) return;
  const { data: row } = await client.from("shop_memory").select("memory").eq("business_id", shop.id).maybeSingle();
  const current: ShopMemory = row ? parseMemory(row.memory) : EMPTY_MEMORY;
  const next = learn(current, note, confirmed);
  if (next === current) return;
  await client.from("shop_memory").upsert({ business_id: shop.id, memory: next, updated_at: new Date().toISOString() });
}
