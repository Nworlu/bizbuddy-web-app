// The live Tell BizBuddy chat. Same follow-ups as WhatsApp (features/whatsapp/lib/thread.ts):
// "what of today?" stays on the last question, and the numbers still come from the books.
// Pure, except loadThread / saveThread, which keep the last few lines on this phone.

import { answerTopic, owingDetail, type Answer } from "@/features/ask/lib/answer";
import { aboutSocials, type Socials } from "@/features/tell/lib/knowledge";
import { continueTalk, parseTurns, remember, threadPrompt, WHAT_YOU_CAN_ASK, type Turn } from "@/features/whatsapp/lib/thread";
import type { BizData } from "@/shared/lib/types";

export type { Turn };
export { threadPrompt, remember };

export type LocalReply = { turns: Turn[]; text: string; answer?: Answer };

const KEY = (id?: string) => `bizbuddy:tell-thread:${id ?? "local"}`;

/** What this message means in the chat already on screen. Null when it should go to the reader. */
export function localTalk(message: string, turns: Turn[], data: BizData, socials: Socials | null, now = new Date()): LocalReply | null {
  const continued = continueTalk(message, turns);
  if (continued) {
    if (continued.kind === "help") return packed(message, WHAT_YOU_CAN_ASK.replace(/_/g, ""), turns);
    if (continued.kind === "chat") return packed(message, continued.reply, turns);
    const answer = continued.detail ? owingDetail(data) : answerTopic(continued.topic, continued.customer, continued.period, data, now);
    return { turns: remember(turns, message, answer.text), text: answer.text, answer };
  }
  if (!socials) return null;
  const social = aboutSocials(message, socials);
  return social ? packed(message, social, turns) : null;
}

function packed(message: string, text: string, turns: Turn[]): LocalReply {
  return { turns: remember(turns, message, text), text };
}

/** A short line to keep, from whatever BizBuddy just showed. */
export function rememberedReply(parts: string[]): string {
  const text = parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  return text.slice(0, 400) || "Okay.";
}

/** The lines to show again when Tell BizBuddy is opened on this phone. */
export function transcript(turns: Turn[]): { text: string; reply: string }[] {
  const out: { text: string; reply: string }[] = [];
  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i];
    if (turn.who !== "owner") continue;
    const next = turns[i + 1];
    if (next?.who === "bizbuddy") i++;
    out.push({ text: turn.text, reply: next?.who === "bizbuddy" ? next.text : "" });
  }
  return out;
}

export function loadThread(businessId?: string): Turn[] {
  if (typeof localStorage === "undefined") return [];
  try {
    return parseTurns(JSON.parse(localStorage.getItem(KEY(businessId)) ?? "null"));
  } catch {
    return [];
  }
}

export function saveThread(businessId: string | undefined, turns: Turn[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(KEY(businessId), JSON.stringify(turns));
  } catch {
    // The chat still works for this visit if the phone won't store it.
  }
}
