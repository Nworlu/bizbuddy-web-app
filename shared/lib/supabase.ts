"use client";

// The connection to BizBuddy's Supabase project, and the RemoteApi that syncOnce() uses.
//
// Needs NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (see .env.example). The
// publishable key is safe in the browser: row level security (supabase/migrations) decides what each
// signed-in user can see. Without them, accounts are switched off and the books stay on the phone.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { RemoteApi, RemoteBusiness, RemoteRow } from "./sync";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let client: SupabaseClient | null | undefined;

/** The Supabase client, or null when accounts aren't set up in this build. */
export function supabase(): SupabaseClient | null {
  if (client === undefined) {
    client = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: "bizbuddy:auth" } }) : null;
  }
  return client;
}

export function accountsEnabled(): boolean {
  // The login address mailbox is needed too (see shared/lib/phone.ts).
  return Boolean(SUPABASE_URL && SUPABASE_KEY && process.env.NEXT_PUBLIC_LOGIN_EMAIL);
}

function db(): SupabaseClient {
  const sb = supabase();
  if (!sb) throw new Error("Accounts are not set up");
  return sb;
}

const BUSINESS_COLUMNS = "id, name, owner_name, phone, type, created_at, updated_at";
/** PostgREST returns at most this many rows per request by default, so pulls page through. */
const PAGE = 1000;

export const remoteApi: RemoteApi = {
  async upsertBusiness(row) {
    // owner_id defaults to the signed-in user on insert, and row level security checks it on update.
    const { error } = await db().from("businesses").upsert(row);
    if (error) throw error;
  },

  async getBusiness() {
    const { data, error } = await db().from("businesses").select(BUSINESS_COLUMNS).maybeSingle();
    if (error) throw error;
    return (data as RemoteBusiness | null) ?? null;
  },

  async upsert(table, rows) {
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await db().from(table).upsert(rows.slice(i, i + 500), { onConflict: "business_id,id" });
      if (error) throw error;
    }
  },

  async pullSince(table, since) {
    const all: RemoteRow[] = [];
    for (let from = 0; ; from += PAGE) {
      let query = db().from(table).select("*").order("updated_at").order("id").range(from, from + PAGE - 1);
      if (since) query = query.gte("updated_at", since);
      const { data, error } = await query;
      if (error) throw error;
      all.push(...((data ?? []) as RemoteRow[]));
      if (!data || data.length < PAGE) return all;
    }
  },
};
