// The WhatsApp Cloud API webhook (Meta). Register https://<your app>/api/whatsapp in Meta's dashboard
// (WhatsApp -> Configuration), with WHATSAPP_VERIFY_TOKEN as the verify token, subscribed to "messages".
//
// GET: Meta's one-time check when the webhook is registered.
// POST: incoming messages. Only calls signed with WHATSAPP_APP_SECRET are accepted. Meta gets its
// 200 straight away; reading the note and replying happen just after (the AI takes a few seconds).

import { after } from "next/server";
import { handleMessage, type Deps } from "@/features/whatsapp/lib/conversation";
import { clearPending, getMemory, getPending, getThread, loadBooks, markSeen, saveChanges, saveMemory, saveThread, setAbout, setPending } from "@/features/whatsapp/server/books";
import { downloadMedia, incomingMessages, MediaTooBigError, sendWhatsApp, showTyping, validSignature } from "@/features/whatsapp/server/meta";
import { IMAGE_MAX_BYTES, LearnError, learnFromImage, learnFromWebsite } from "@/features/tell/server/learn-business";
import { whoIsChatting } from "@/features/whatsapp/server/who";
import { interpret, TellBusyError } from "@/features/tell/server/interpret";
import { addReminder, cancelReminder, noteInbound, settleReminder, upcomingReminders } from "@/features/reminders/server/store";

// Room for the AI to read the note and for the reply to go out after the 200.
export const maxDuration = 60;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  if (verifyToken && url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === verifyToken) {
    return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

const deps: Deps = {
  markSeen,
  whoIsChatting,
  loadBooks,
  saveChanges,
  getPending,
  setPending,
  clearPending,
  setAbout,
  getThread,
  saveThread,
  getMemory,
  saveMemory,
  interpret,
  isBusy: (error) => error instanceof TellBusyError,
  send: sendWhatsApp,
  learn: {
    fromImage: async (image) => learnFromImage({ ...(await downloadMedia(image.id, IMAGE_MAX_BYTES)), caption: image.caption }),
    fromWebsite: learnFromWebsite,
    problem: (error) => (error instanceof LearnError ? error.message : error instanceof MediaTooBigError ? "That picture is too big. Send one under 5 MB." : null),
  },
  reminders: { add: addReminder, upcoming: upcomingReminders, cancel: cancelReminder, settle: settleReminder },
  // Without migration 0006 this fails; replies still go out.
  noteInbound: (phone) => noteInbound(phone).catch((error) => console.error("WhatsApp: couldn't note the chat time", error instanceof Error ? error.message : error)),
  showTyping: (messageId) =>
    showTyping(messageId).catch((error) => console.error("WhatsApp: typing indicator failed", error instanceof Error ? error.message : error)),
  appUrl: process.env.NEXT_PUBLIC_APP_URL,
};

export async function POST(request: Request) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return new Response("WhatsApp isn't set up", { status: 503 });

  // The signature covers the exact bytes Meta sent, so read the raw body before parsing it.
  const raw = await request.text();
  if (!validSignature(raw, request.headers.get("x-hub-signature-256"), secret)) return new Response("Bad signature", { status: 401 });

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const messages = incomingMessages(payload);
  after(async () => {
    for (const message of messages) {
      try {
        await handleMessage(message, deps);
      } catch (error) {
        console.error("WhatsApp: failed to handle a message", error instanceof Error ? error.message : error);
        await sendWhatsApp(message.from, "Sorry, something went wrong on my side. Please send that again in a moment.").catch(() => undefined);
      }
    }
  });
  return new Response("OK", { status: 200 });
}
