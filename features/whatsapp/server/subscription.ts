// Tells each shop that used its 15 test messages that a subscription is ready.
// Stays quiet until WHATSAPP_SUBSCRIPTION_TEMPLATE is set, so nobody is told before it exists.
// The scheduler that already sends reminders calls this. Outside 24 hours WhatsApp only allows a template.

import { TRIAL_MESSAGES } from "@/features/tell/lib/memory";
import { normalizePhone } from "@/shared/lib/phone";
import { getMemory, saveMemory, shopsWaitingForSubscription } from "@/features/whatsapp/server/books";
import { sendTemplate } from "@/features/whatsapp/server/meta";

export async function tellSubscriptionReady(): Promise<{ waiting: number; sent: number; reason?: string }> {
  const waiting = await shopsWaitingForSubscription();
  const template = process.env.WHATSAPP_SUBSCRIPTION_TEMPLATE;
  if (!template) return { waiting: waiting.length, sent: 0, ...(waiting.length > 0 ? { reason: "template-not-set" } : {}) };
  let sent = 0;
  for (const shop of waiting) {
    const phone = normalizePhone(shop.phone);
    if (!phone) continue;
    const first = shop.ownerName.trim().split(/\s+/)[0] || "there";
    await sendTemplate(phone, template, [first, shop.shopName || "your shop"], process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en");
    const memory = await getMemory(shop.businessId);
    if (memory.trialUsed >= TRIAL_MESSAGES) await saveMemory(shop.businessId, { ...memory, subscriptionTold: true });
    sent++;
  }
  return { waiting: waiting.length, sent };
}
