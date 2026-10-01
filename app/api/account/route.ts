// DELETE /api/account: removes the signed-in account and everything saved with it.
//
// The user id comes from the access token. The phone comes from that account's login
// (shared/lib/phone.ts), never from the request, so this cannot delete a different account.

import { createClient } from "@supabase/supabase-js";
import { removeAccount } from "@/features/account/server/delete-account";
import { phoneFromLoginEmail } from "@/shared/lib/phone";

export async function DELETE(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key || !secret) return Response.json({ error: "Accounts aren't set up." }, { status: 503 });
  if (!token) return Response.json({ error: "Log in first." }, { status: 401 });

  const { data, error } = await createClient(url, key, { auth: { persistSession: false } }).auth.getUser(token);
  if (error || !data.user) return Response.json({ error: "Log in first." }, { status: 401 });

  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const missing = (code: string | undefined) => code === "PGRST205" || code === "42P01";
  try {
    await removeAccount(data.user.id, phoneFromLoginEmail(data.user.email), {
      async businessId(userId) {
        const { data: shop, error: shopError } = await admin.from("businesses").select("id").eq("owner_id", userId).maybeSingle();
        if (shopError) throw shopError;
        return shop?.id ?? null;
      },
      async deleteShopRows(table, businessId) {
        const { error: rowError } = await admin.from(table).delete().eq("business_id", businessId);
        if (!rowError) return "ok";
        if (missing(rowError.code)) return "missing";
        throw rowError;
      },
      async deleteShop(businessId) {
        const { error: shopError } = await admin.from("businesses").delete().eq("id", businessId);
        if (shopError) throw shopError;
      },
      async deletePhoneRows(table, phone) {
        const { error: rowError } = await admin.from(table).delete().eq("phone", phone);
        if (!rowError) return "ok";
        // 0010 (whatsapp_thread) may not have been run yet.
        if (missing(rowError.code)) return "missing";
        throw rowError;
      },
      async seenMessageIds() {
        const ids: string[] = [];
        const page = 1000;
        for (let from = 0; ; from += page) {
          const { data: rows, error: rowError } = await admin.from("whatsapp_messages").select("id").range(from, from + page - 1);
          if (rowError) {
            if (missing(rowError.code)) return [];
            throw rowError;
          }
          for (const row of rows ?? []) if (typeof row.id === "string") ids.push(row.id);
          if (!rows || rows.length < page) return ids;
        }
      },
      async deleteSeenMessages(ids) {
        const { error: rowError } = await admin.from("whatsapp_messages").delete().in("id", ids);
        if (rowError) throw rowError;
      },
      async deleteUserRows(table, userId) {
        const { error: rowError } = await admin.from(table).delete().eq("user_id", userId);
        if (!rowError) return "ok";
        if (missing(rowError.code)) return "missing";
        throw rowError;
      },
      async deleteUser(userId) {
        const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
        if (deleteError) throw deleteError;
      },
    });
  } catch (caught) {
    console.error("Account: delete failed", caught instanceof Error ? caught.message : caught);
    return Response.json({ error: "Couldn't delete the account. Try again." }, { status: 502 });
  }
  return Response.json({ deleted: true });
}
