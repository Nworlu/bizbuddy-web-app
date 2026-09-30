// Server only: WhatsApp Cloud API (Meta). Checks that webhook calls really come from Meta, reads
// incoming messages, and sends replies.
//
// Needs WHATSAPP_APP_SECRET (to check signatures), WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID
// (to reply). WHATSAPP_GRAPH_VERSION picks the Graph API version (default v23.0).

import { createHmac, timingSafeEqual } from "node:crypto";

/** True when the X-Hub-Signature-256 header is Meta's HMAC of this exact body with the app secret. */
export function validSignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected = Buffer.from(createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex"), "hex");
  const given = Buffer.from(header.slice("sha256=".length), "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export interface Incoming {
  id: string;
  /** Sender's number as WhatsApp gives it: country code, no plus (e.g. 2348031234567). */
  from: string;
  /** The name WhatsApp shows for this chat, when Meta sends it. The books' name wins once we know them. */
  profileName?: string;
  text?: string;
  /** The id of a reply button they tapped. */
  buttonId?: string;
  /** Anything else (voice note, image, sticker…), so we can say we only read text for now. */
  other?: string;
}

type WebhookMessage = {
  id?: string;
  from?: string;
  type?: string;
  text?: { body?: string };
  interactive?: { button_reply?: { id?: string } };
  button?: { payload?: string };
};

type WebhookValue = {
  contacts?: { wa_id?: string; profile?: { name?: string } }[];
  messages?: WebhookMessage[];
};

/** The messages in a webhook call. Delivery and read receipts ("statuses") are ignored. */
export function incomingMessages(payload: unknown): Incoming[] {
  const out: Incoming[] = [];
  const entries = (payload as { entry?: { changes?: { value?: WebhookValue }[] }[] })?.entry ?? [];
  for (const entry of entries) {
    for (const change of entry.changes ?? []) {
      const names = new Map((change.value?.contacts ?? []).map((c) => [c.wa_id, c.profile?.name?.trim()]));
      for (const m of change.value?.messages ?? []) {
        if (!m.id || !m.from) continue;
        const profileName = names.get(m.from) || undefined;
        if (m.type === "text" && m.text?.body) out.push({ id: m.id, from: m.from, profileName, text: m.text.body });
        else if (m.type === "interactive" && m.interactive?.button_reply?.id) out.push({ id: m.id, from: m.from, profileName, buttonId: m.interactive.button_reply.id });
        else if (m.type === "button" && m.button?.payload) out.push({ id: m.id, from: m.from, profileName, buttonId: m.button.payload });
        else out.push({ id: m.id, from: m.from, profileName, other: m.type ?? "unknown" });
      }
    }
  }
  return out;
}

export type Button = { id: string; title: string };

/** Sends a text reply, with up to three reply buttons. Throws if Meta refuses. */
export async function sendWhatsApp(to: string, body: string, buttons: Button[] = []): Promise<void> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) throw new Error("WhatsApp sending isn't set up");
  const version = process.env.WHATSAPP_GRAPH_VERSION || "v23.0";
  // WhatsApp's limits: 4096 characters for text, 1024 for a message with buttons, 20 per button title.
  const message =
    buttons.length > 0
      ? {
          type: "interactive",
          interactive: {
            type: "button",
            body: { text: body.slice(0, 1024) },
            action: { buttons: buttons.slice(0, 3).map((b) => ({ type: "reply", reply: { id: b.id, title: b.title.slice(0, 20) } })) },
          },
        }
      : { type: "text", text: { body: body.slice(0, 4096), preview_url: false } };
  const response = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, ...message }),
  });
  if (!response.ok) throw new Error(`WhatsApp send failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
}

/**
 * Sends an approved message template. WhatsApp only lets a business start a conversation this way:
 * free text is allowed only within 24 hours of the person's last message. `params` fill {{1}}, {{2}}…
 */
export async function sendTemplate(to: string, name: string, params: string[], language = "en"): Promise<void> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) throw new Error("WhatsApp sending isn't set up");
  const version = process.env.WHATSAPP_GRAPH_VERSION || "v23.0";
  const response = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name,
        language: { code: language },
        ...(params.length > 0 ? { components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text: text.slice(0, 60) })) }] } : {}),
      },
    }),
  });
  if (!response.ok) throw new Error(`WhatsApp template failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
}

/**
 * Marks the sender's message read (blue ticks) and shows "typing…" in their chat until BizBuddy
 * replies, or for up to 25 seconds. Throws if Meta refuses; callers ignore that, it's only a nicety.
 */
export async function showTyping(messageId: string): Promise<void> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) return;
  const version = process.env.WHATSAPP_GRAPH_VERSION || "v23.0";
  const response = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", status: "read", message_id: messageId, typing_indicator: { type: "text" } }),
  });
  if (!response.ok) throw new Error(`WhatsApp typing indicator failed (${response.status}): ${(await response.text()).slice(0, 200)}`);
}
