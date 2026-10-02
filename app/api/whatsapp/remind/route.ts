// GET /api/whatsapp/remind, called by a scheduler every minute with
// `Authorization: Bearer <CRON_SECRET>`. Vercel Cron sends that header by itself (Pro plan for anything
// more often than daily); a free service such as cron-job.org works too, also against ngrok.
//
// 1. Reminders owners set ("remind me Friday at 10…") whose time has come. Within 24 hours of the
//    owner's last message it's a normal message with Done / In 1 hour / Tomorrow. After that WhatsApp
//    only allows an approved template: WHATSAPP_REMINDER_TEMPLATE (default bizbuddy_reminder), body
//    "⏰ Reminder: {{1}}" with quick replies "Done" and "Remind me tomorrow".
// 2. One reminder per note left without Save or Cancel, after the shop's choice (30 minutes by default,
//    2 hours, or never), and only inside the 24-hour window.
// 3. Check-ins, for owners who have messaged BizBuddy before: at 7pm on a day with nothing recorded, and
//    Sunday evening's weekly summary. Outside the 24-hour window they use the templates
//    WHATSAPP_CHECKIN_TEMPLATE (bizbuddy_checkin) and WHATSAPP_WEEKLY_TEMPLATE (bizbuddy_weekly).
//
// Supabase's pg_cron calls this every minute (migration 0009).

import { checkInDue, eveningText, recordedOn, weeklySummary, type CheckInKind } from "@/features/checkins/lib/checkins";
import { chattingOwners, claimCheckIn, releaseCheckIn } from "@/features/checkins/server/store";
import { formatWhen, lagosClock } from "@/features/reminders/lib/when";
import { claimReminder, dueReminders, lastInbound, releaseReminder } from "@/features/reminders/server/store";
import { unsavedReminderMinutes, trialOpen } from "@/features/tell/lib/memory";
import { reminderFor } from "@/features/whatsapp/lib/conversation";
import { reminderButtonId } from "@/features/whatsapp/lib/text";
import { findShop, getMemory, loadBooks, markReminded, pendingToRemind } from "@/features/whatsapp/server/books";
import { sendTemplate, sendWhatsApp } from "@/features/whatsapp/server/meta";
import { tellSubscriptionReady } from "@/features/whatsapp/server/subscription";

export const maxDuration = 60;

const DAY_MS = 24 * 3_600_000;
/** A reminder that couldn't be sent for this long is given up on rather than retried forever. */
const GIVE_UP_MS = 12 * 3_600_000;

const log = (what: string, error: unknown) => console.error(`WhatsApp: ${what}`, error instanceof Error ? error.message : error);

async function sendDueReminders(now: Date): Promise<number> {
  let sent = 0;
  for (const reminder of await dueReminders(now)) {
    if (!(await claimReminder(reminder.id, now))) continue; // Another run took it.
    try {
      const last = await lastInbound(reminder.phone);
      if (last && now.getTime() - last.getTime() < DAY_MS - 60_000) {
        await sendWhatsApp(reminder.phone, `⏰ *Reminder:* ${reminder.text}\n_(set for ${formatWhen(reminder.dueAt, now)})_`, [
          { id: reminderButtonId("done", reminder.id), title: "Done" },
          { id: reminderButtonId("hour", reminder.id), title: "In 1 hour" },
          { id: reminderButtonId("tomorrow", reminder.id), title: "Tomorrow" },
        ]);
      } else {
        await sendTemplate(
          reminder.phone,
          process.env.WHATSAPP_REMINDER_TEMPLATE || "bizbuddy_reminder",
          [reminder.text],
          process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en",
          [reminderButtonId("done", reminder.id), reminderButtonId("tomorrow", reminder.id)],
        );
      }
      sent++;
    } catch (error) {
      log("reminder failed", error);
      // Try again next run, unless it's been failing for hours (e.g. the template isn't approved).
      if (now.getTime() - new Date(reminder.dueAt).getTime() < GIVE_UP_MS) await releaseReminder(reminder.id).catch(() => undefined);
    }
  }
  return sent;
}

async function remindUnsaved(now: Date): Promise<number> {
  let sent = 0;
  for (const { phone, pending, since } of await pendingToRemind(30 * 60_000)) {
    try {
      const minutes = unsavedReminderMinutes((await getMemory(pending.businessId)).unsavedReminder);
      if (minutes === null || now.getTime() - since.getTime() < minutes * 60_000) continue;
      const reminder = reminderFor(pending, await loadBooks(pending.businessId));
      if (!reminder) continue;
      await markReminded(phone, pending, now.toISOString()); // Marked first: better missed than sent twice.
      await sendWhatsApp(phone, reminder.body, reminder.buttons);
      sent++;
    } catch (error) {
      log("unsaved-note reminder failed", error);
    }
  }
  return sent;
}

async function sendCheckIns(now: Date): Promise<number> {
  const clock = lagosClock(now);
  const kinds = (["evening", "weekly"] as CheckInKind[]).filter((kind) => checkInDue(kind, clock));
  if (kinds.length === 0) return 0;
  let sent = 0;
  for (const { phone, lastInbound } of await chattingOwners()) {
    try {
      const businessId = await findShop(phone);
      if (!businessId) continue;
      const memory = await getMemory(businessId);
      if (!trialOpen(memory)) continue;
      const wanted = kinds.filter((kind) => memory.checkIns[kind]);
      if (wanted.length === 0) continue;
      const books = await loadBooks(businessId);
      const open = now.getTime() - lastInbound.getTime() < DAY_MS - 60_000;
      const owner = books.business?.ownerName ?? "there";
      for (const kind of wanted) {
        // Sunday's summary replaces that evening's nudge; a day with records needs no nudge.
        if (kind === "evening" && (wanted.includes("weekly") || recordedOn(books, clock.date))) continue;
        if (!(await claimCheckIn(businessId, kind, clock.date))) continue;
        try {
          if (kind === "evening") {
            if (open) await sendWhatsApp(phone, eveningText(owner));
            else await sendTemplate(phone, process.env.WHATSAPP_CHECKIN_TEMPLATE || "bizbuddy_checkin", [owner.split(/\s+/)[0], books.business?.name ?? "your shop"], process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en");
          } else {
            const summary = weeklySummary(books, clock.date);
            if (open) await sendWhatsApp(phone, summary.text);
            else await sendTemplate(phone, process.env.WHATSAPP_WEEKLY_TEMPLATE || "bizbuddy_weekly", summary.params, process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en");
          }
          sent++;
        } catch (error) {
          log(`${kind} check-in failed`, error);
          await releaseCheckIn(businessId, kind, clock.date).catch(() => undefined);
        }
      }
    } catch (error) {
      log("check-in failed", error);
    }
  }
  return sent;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const now = new Date();
  const [reminders, unsaved, checkIns, subscription] = await Promise.all([
    sendDueReminders(now).catch((error) => (log("reminders run failed", error), 0)),
    remindUnsaved(now).catch((error) => (log("unsaved run failed", error), 0)),
    sendCheckIns(now).catch((error) => (log("check-ins run failed", error), 0)),
    tellSubscriptionReady().catch((error) => (log("subscription notice failed", error), { waiting: 0, sent: 0 })),
  ]);
  return Response.json({ reminders, unsaved, checkIns, subscription });
}
