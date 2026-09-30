// Server only: a shop's books on Supabase, read and written with the secret key. WhatsApp messages
// arrive with no signed-in user, so this bypasses row level security; every query here is limited to
// the one shop the sender's number belongs to (found by business_for_login, supabase/migrations/0002).
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY. Never import this from client code.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loginEmail } from "@/shared/lib/phone";
import { businessFromRemote, diff, recordFromRemote, recordToRemote, TABLES, type RemoteBusiness, type RemoteRow } from "@/shared/lib/sync";
import type { BizData } from "@/shared/lib/types";
import type { Draft } from "@/features/tell/lib/intents";

let client: SupabaseClient | undefined;
function db(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase secret key isn't set up");
  client ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

/** The shop whose account logs in with this phone number, or null. */
export async function findShop(phone: string): Promise<string | null> {
  const { data, error } = await db().rpc("business_for_login", { login_email: loginEmail(phone) });
  if (error) throw error;
  return (data as string | null) ?? null;
}

export interface WhatsAppCustomer {
  businessId: string;
  customerId: string;
  name: string;
  shop: string;
  ownerName: string;
}

/** Every customer record saved with this WhatsApp number. */
export async function findCustomersByPhone(phone: string): Promise<WhatsAppCustomer[]> {
  const { data, error } = await db().rpc("customers_for_whatsapp", { sender: phone });
  if (error) throw error;
  return ((data ?? []) as { business_id: string; customer_id: string; customer_name: string; shop_name: string; owner_name: string }[]).map((row) => ({
    businessId: row.business_id,
    customerId: row.customer_id,
    name: row.customer_name,
    shop: row.shop_name,
    ownerName: row.owner_name,
  }));
}

/** The customer an owner's chat is currently about, or null. */
export async function getAbout(phone: string): Promise<{ businessId: string; customerId: string; name: string } | null> {
  const { data, error } = await db().from("whatsapp_focus").select("business_id, customer_id, customer_name").eq("phone", phone).maybeSingle();
  if (error) throw error;
  return data ? { businessId: data.business_id as string, customerId: data.customer_id as string, name: data.customer_name as string } : null;
}

/** Remembers who an owner's chat is about. Pass null to forget. */
export async function setAbout(phone: string, about: { businessId: string; customerId: string; name: string } | null): Promise<void> {
  if (!about) {
    const { error } = await db().from("whatsapp_focus").delete().eq("phone", phone);
    if (error) throw error;
    return;
  }
  const { error } = await db().from("whatsapp_focus").upsert({
    phone,
    business_id: about.businessId,
    customer_id: about.customerId,
    customer_name: about.name,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

const PAGE = 1000;

async function rowsOf(table: string, businessId: string): Promise<RemoteRow[]> {
  const all: RemoteRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db().from(table).select("*").eq("business_id", businessId).eq("deleted", false).order("id").range(from, from + PAGE - 1);
    if (error) throw error;
    all.push(...((data ?? []) as RemoteRow[]));
    if (!data || data.length < PAGE) return all;
  }
}

/** The shop's current books, as the app sees them. */
export async function loadBooks(businessId: string): Promise<BizData> {
  const { data: business, error } = await db().from("businesses").select("id, name, owner_name, phone, type, created_at").eq("id", businessId).single();
  if (error) throw error;
  const [customers, sales, payments, expenses] = await Promise.all(TABLES.map((t) => rowsOf(t, businessId)));
  return {
    version: 1,
    business: businessFromRemote(business as RemoteBusiness),
    customers: customers.map((r) => recordFromRemote("customers", r)) as BizData["customers"],
    sales: sales.map((r) => recordFromRemote("sales", r)) as BizData["sales"],
    payments: payments.map((r) => recordFromRemote("payments", r)) as BizData["payments"],
    expenses: expenses.map((r) => recordFromRemote("expenses", r)) as BizData["expenses"],
  };
}

/** Writes what changed between two versions of the books. Phones pick it up on their next sync. */
export async function saveChanges(businessId: string, before: BizData, after: BizData): Promise<void> {
  for (const table of TABLES) {
    const rows = diff(before, after)
      .filter((op): op is Extract<typeof op, { kind: "record" }> => op.kind === "record" && op.table === table)
      .map((op) => recordToRemote(table, op.row, businessId, op.deleted));
    if (rows.length === 0) continue;
    const { error } = await db().from(table).upsert(rows, { onConflict: "business_id,id" });
    if (error) throw error;
  }
}

export async function getPending(phone: string): Promise<{ businessId: string; drafts: Draft[] } | null> {
  const { data, error } = await db().from("whatsapp_pending").select("business_id, drafts").eq("phone", phone).maybeSingle();
  if (error) throw error;
  return data ? { businessId: data.business_id as string, drafts: data.drafts as Draft[] } : null;
}

export async function setPending(phone: string, businessId: string, drafts: Draft[]): Promise<void> {
  const { error } = await db().from("whatsapp_pending").upsert({ phone, business_id: businessId, drafts, created_at: new Date().toISOString() });
  if (error) throw error;
}

export async function clearPending(phone: string): Promise<void> {
  const { error } = await db().from("whatsapp_pending").delete().eq("phone", phone);
  if (error) throw error;
}

/** Records a message id. False when it was already handled (WhatsApp sometimes delivers twice). */
export async function markSeen(messageId: string): Promise<boolean> {
  const { error } = await db().from("whatsapp_messages").insert({ id: messageId });
  if (!error) return true;
  if (error.code === "23505") return false; // unique_violation: seen before
  throw error;
}
