// The Tell BizBuddy chat on the owner's account. Row level security keeps it to their shop.

import { createClient } from "@supabase/supabase-js";
import { parseArchive, type Turn } from "@/features/whatsapp/lib/thread";

function db(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
}

function missing(error: { code?: string; message?: string } | null): boolean {
  return error?.code === "42P01" || error?.code === "PGRST205" || /tell_threads/.test(error?.message ?? "");
}

export async function tellThreadFor(token: string): Promise<Turn[]> {
  const client = db(token);
  if (!client) return [];
  const { data, error } = await client.from("tell_threads").select("turns").maybeSingle();
  if (error || !data) return [];
  return parseArchive(data.turns);
}

export async function saveTellThread(token: string, turns: Turn[]): Promise<boolean> {
  const client = db(token);
  if (!client) return false;
  const { data: shop, error: shopError } = await client.from("businesses").select("id, phone").maybeSingle();
  if (shopError || !shop) return false;
  const { error } = await client.from("tell_threads").upsert({ business_id: shop.id, turns, updated_at: new Date().toISOString() });
  if (missing(error)) return false;
  return !error;
}

export async function clearTellThread(token: string): Promise<{ phone: string }> {
  const client = db(token);
  if (!client) return { phone: "" };
  const { data: shop } = await client.from("businesses").select("id, phone").maybeSingle();
  if (!shop) return { phone: "" };
  const { error } = await client.from("tell_threads").delete().eq("business_id", shop.id);
  if (error && !missing(error)) throw error;
  return { phone: String(shop.phone ?? "") };
}
