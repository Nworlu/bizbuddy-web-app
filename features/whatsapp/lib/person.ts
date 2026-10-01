// Who a WhatsApp chat is with. BizBuddy talks to the shop owner about their business.
// A customer's number is not a chat: this is not a way for buyers to be told what they owe.

import type { Action } from "@/features/tell/lib/intents";

export type ChatWith =
  | { kind: "owner"; name: string; shop: string; businessId: string; about: { id: string; name: string } | null }
  | { kind: "unknown"; profileName: string | null };

/** The shop owner, or someone whose number is not an account. */
export function resolveChat(input: {
  owner: { name: string; shop: string; businessId: string; about: { id: string; name: string } | null } | null;
  profileName: string | null;
}): ChatWith {
  if (input.owner) return { kind: "owner", ...input.owner };
  return { kind: "unknown", profileName: input.profileName };
}

/** What to tell OpenAI, in the user message. The shared instructions stay unchanged. */
export function chatPrompt(chat: ChatWith): string | null {
  if (chat.kind !== "owner") return null;
  const about = chat.about
    ? ` They were just recording something for ${chat.about.name}. "He", "she", or a payment with no name means ${chat.about.name}, unless the note names someone else.`
    : "";
  return `This WhatsApp chat is with ${chat.name}, the owner of ${chat.shop}. Talk with them like a person who helps them run the shop: sales, money that came in, and spending. Answer what they just said. Don't greet them. Don't offer a menu of what you can record.${about}`;
}

/** Fills in the customer the owner was just recording, when this note never names anyone. */
export function personalize(actions: Action[], chat: ChatWith): Action[] {
  const name = chat.kind === "owner" ? chat.about?.name : undefined;
  if (!name) return actions;
  return actions.map((action) => {
    if (!("customer" in action) || action.customer?.trim()) return action;
    if (action.kind === "question" && action.topic !== "customer_balance" && action.topic !== "customer_purchases") return action;
    if (action.kind !== "sale" && action.kind !== "payment" && action.kind !== "question") return action;
    return { ...action, customer: name };
  });
}

/**
 * The customer an owner's notes should stay on. A name in the note switches to that person.
 * No name keeps the current person. Several different names don't change it.
 */
export function nextAbout(actions: Action[], known: { id: string; name: string }[]): { id: string; name: string } | undefined {
  const found = new Map<string, { id: string; name: string }>();
  for (const action of actions) {
    if (!("customer" in action) || !action.customer?.trim()) continue;
    const hit = known.find((person) => person.name.toLowerCase() === action.customer!.trim().toLowerCase());
    if (hit) found.set(hit.id, hit);
  }
  if (found.size !== 1) return undefined;
  const person = [...found.values()][0];
  return { id: person.id, name: person.name };
}

/** First line of a reply: the owner and their shop, not a buyer. */
export function chatHeading(chat: ChatWith): string | null {
  if (chat.kind !== "owner") return null;
  const first = chat.name.split(/\s+/)[0];
  return `Hi ${first}. This is BizBuddy for *${chat.shop}*.`;
}
