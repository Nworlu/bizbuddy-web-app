// Server only. One shop's memory, stored on their account. The website uses the owner's
// access token, so row level security keeps it to their shop. WhatsApp uses the same table
// with the secret key (features/whatsapp/server/books.ts) when it replies.

import { createClient } from "@supabase/supabase-js";
import { offerDue, reviewed, withAutoSave, type Review } from "../lib/autosave";
import { shopProfile } from "../lib/profile";
import { EMPTY_MEMORY, learn, memoryForPrompt, parseMemory, confirmedDraft, type AutoSave, type ShopMemory } from "../lib/memory";

function db(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * What to send with the next note: who the owner and shop are (profile), what this shop has taught
 * BizBuddy (prompt), and whether to save without asking. Parts are null when there's nothing yet.
 */
export async function memoryFor(token: string): Promise<{ profile: string | null; prompt: string | null; autoSave: AutoSave }> {
  const client = db(token);
  if (!client) return { profile: null, prompt: null, autoSave: "off" };
  // Row level security limits both to the owner's own shop.
  const [{ data: shop }, { data, error }] = await Promise.all([client.from("businesses").select("*").maybeSingle(), client.from("shop_memory").select("memory").maybeSingle()]);
  const profile = shop ? shopProfile({ name: shop.name, ownerName: shop.owner_name, type: shop.type, about: shop.about }) : null;
  if (error || !data) return { profile, prompt: null, autoSave: "off" };
  const memory = parseMemory(data.memory);
  return { profile, prompt: memoryForPrompt(memory), autoSave: memory.autoSave };
}

/** Loads this owner's memory, lets `change` update it, and saves it if it changed. Null when that isn't possible. */
async function updateMemory(token: string, change: (memory: ShopMemory) => ShopMemory): Promise<ShopMemory | null> {
  const client = db(token);
  if (!client) return null;
  const { data: shop, error: shopError } = await client.from("businesses").select("id").maybeSingle();
  if (shopError || !shop) return null;
  const { data: row } = await client.from("shop_memory").select("memory").eq("business_id", shop.id).maybeSingle();
  const current: ShopMemory = row ? parseMemory(row.memory) : EMPTY_MEMORY;
  const next = change(current);
  if (next === current) return current;
  const { error } = await client.from("shop_memory").upsert({ business_id: shop.id, memory: next, updated_at: new Date().toISOString() });
  return error ? null : next;
}

/**
 * What the owner did with a draft. A saved note (with any corrections they made) is remembered, and
 * the run of drafts saved unchanged goes up or back to 0. Returns true when it's time to offer auto-save.
 * The record itself is already saved by then; a failure here only means this note doesn't teach.
 */
export async function reviewNote(token: string, note: string, draft: unknown, review: Review): Promise<boolean> {
  const confirmed = confirmedDraft(draft);
  let offer = false;
  await updateMemory(token, (memory) => {
    let next = reviewed(confirmed ? learn(memory, note, confirmed) : memory, review);
    offer = offerDue(next);
    if (offer) next = withAutoSave(next, "offered");
    return next;
  });
  return offer;
}

export async function autoSaveFor(token: string): Promise<AutoSave> {
  return (await memoryFor(token)).autoSave;
}

/** Turns auto-save on, or off ("declined": BizBuddy won't offer again; Settings can turn it back on). */
export async function setAutoSave(token: string, on: boolean): Promise<boolean> {
  return (await updateMemory(token, (memory) => withAutoSave(memory, on ? "on" : "declined"))) !== null;
}
