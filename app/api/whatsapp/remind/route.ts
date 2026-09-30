// GET /api/whatsapp/remind: reminds owners about a note BizBuddy showed them that they never saved or
// cancelled. One reminder per note, after WHATSAPP_REMIND_AFTER_MINUTES (default 30), and only inside
// WhatsApp's 24-hour window, when free text is still allowed.
//
// Call it every few minutes from a scheduler with `Authorization: Bearer <CRON_SECRET>`. Vercel Cron
// sends that header by itself (Pro plan for anything more often than daily); a free service such as
// cron-job.org works too, including against the ngrok address while testing.

import { reminderFor } from "@/features/whatsapp/lib/conversation";
import { loadBooks, markReminded, pendingToRemind } from "@/features/whatsapp/server/books";
import { sendWhatsApp } from "@/features/whatsapp/server/meta";

export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });

  const minutes = Number(process.env.WHATSAPP_REMIND_AFTER_MINUTES) || 30;
  const due = await pendingToRemind(minutes * 60_000);
  let sent = 0;
  for (const { phone, pending } of due) {
    try {
      const reminder = reminderFor(pending, await loadBooks(pending.businessId));
      if (!reminder) continue;
      // Marked first: a failed send is better missed than sent twice.
      await markReminded(phone, pending, new Date().toISOString());
      await sendWhatsApp(phone, reminder.body, reminder.buttons);
      sent++;
    } catch (error) {
      console.error("WhatsApp: reminder failed", error instanceof Error ? error.message : error);
    }
  }
  return Response.json({ due: due.length, sent });
}
