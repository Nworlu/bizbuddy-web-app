// POST /api/whatsapp/welcome: sends a new account its WhatsApp welcome, once.
//
// The number comes from the signed-in account's login (shared/lib/phone.ts), never from the request,
// so this can only ever message the account's own phone. WhatsApp only allows a business to start a
// chat with an approved template: WHATSAPP_WELCOME_TEMPLATE (default "bizbuddy_welcome"), whose body
// takes {{1}} = first name and {{2}} = shop name.

import { createClient } from "@supabase/supabase-js";
import { phoneFromLoginEmail } from "@/shared/lib/phone";
import { claimWelcome, releaseWelcome } from "@/features/whatsapp/server/books";
import { sendTemplate } from "@/features/whatsapp/server/meta";

/** Template parameters can't hold new lines, tabs, or long runs of spaces. */
function clean(value: unknown, fallback: string): string {
  const text =
    typeof value === "string"
      ? value
          .replace(/[\t\n\r]+/g, " ")
          .replace(/\s{2,}/g, " ")
          .trim()
          .slice(0, 60)
      : "";
  return text || fallback;
}

export async function POST(request: Request) {
  if (!process.env.WHATSAPP_ACCESS_TOKEN || !process.env.SUPABASE_SECRET_KEY)
    return Response.json(
      { sent: false, reason: "not-set-up" },
      { status: 503 },
    );

  const token = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !key)
    return Response.json(
      { sent: false, reason: "signed-out" },
      { status: 401 },
    );
  const { data, error } = await createClient(url, key, {
    auth: { persistSession: false },
  }).auth.getUser(token);
  if (error || !data.user)
    return Response.json(
      { sent: false, reason: "signed-out" },
      { status: 401 },
    );

  const phone = phoneFromLoginEmail(data.user.email);
  if (!phone)
    return Response.json({ sent: false, reason: "no-phone" }, { status: 400 });

  let body: { ownerName?: unknown; shopName?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // Names are optional; the template still reads well with the fallbacks.
  }
  const firstName = clean(body.ownerName, "there").split(" ")[0];
  const shopName = clean(body.shopName, "your shop");

  if (!(await claimWelcome(data.user.id, phone)))
    return Response.json({ sent: false, reason: "already" });
  try {
    // const template = "hello_world";
    const template =
      process.env.WHATSAPP_WELCOME_TEMPLATE || "bizbuddy_welcome";
    // Meta's sample "hello_world" (handy for testing before our template is approved) takes no values.
    const params = template === "hello_world" ? [] : [firstName, shopName];
    await sendTemplate(
      phone,
      template,
      params,
      process.env.WHATSAPP_TEMPLATE_LANGUAGE ||
        (template === "hello_world" ? "en_US" : "en"),
    );
    console.log("WhatsApp welcome sent successfully", {
      phone,
      template,
      params,
    });
    return Response.json({ sent: true });
  } catch (sendError) {
    // Let a later try succeed, e.g. once Meta has approved the template.
    await releaseWelcome(data.user.id).catch(() => undefined);
    console.error(
      "WhatsApp welcome failed",
      sendError instanceof Error ? sendError.message : sendError,
    );
    return Response.json(
      { sent: false, reason: "send-failed" },
      { status: 502 },
    );
  }
}
