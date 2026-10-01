// DELETE /api/account: removes the signed-in account and the shop that hangs off it.
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
  try {
    await removeAccount(data.user.id, phoneFromLoginEmail(data.user.email), {
      async deletePhoneRows(table, phone) {
        const { error: rowError } = await admin.from(table).delete().eq("phone", phone);
        if (!rowError) return "ok";
        // 0010 (whatsapp_thread) may not have been run yet.
        if (rowError.code === "PGRST205" || rowError.code === "42P01") return "missing";
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
