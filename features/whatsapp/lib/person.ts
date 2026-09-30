// Who a WhatsApp chat is with, and how a note changes once we know.
// Pure: the server looks the number up, then these functions do the rest.

import type { Action } from "@/features/tell/lib/intents";
import { normalizePhone } from "@/shared/lib/phone";
import { formatNaira } from "@/shared/lib/format";

export interface KnownCustomer {
  id: string;
  name: string;
  phone: string;
  businessId: string;
  shop: string;
}

/** Customers in these books whose phone is this WhatsApp number. */
export function customersOnPhone(people: KnownCustomer[], sender: string): KnownCustomer[] {
  const needle = normalizePhone(sender);
  if (!needle) return [];
  return people.filter((person) => normalizePhone(person.phone) === needle);
}

export type ChatWith =
  | { kind: "owner"; name: string; shop: string; businessId: string; about: { id: string; name: string } | null }
  | { kind: "customer"; name: string; shop: string; businessId: string; customerId: string }
  | { kind: "ambiguous" }
  | { kind: "unknown"; profileName: string | null };

/** The person this chat should speak to. A shop owner's number wins over a customer record with the same phone. */
export function resolveChat(input: {
  owner: { name: string; shop: string; businessId: string; about: { id: string; name: string } | null } | null;
  matches: KnownCustomer[];
  profileName: string | null;
}): ChatWith {
  if (input.owner) return { kind: "owner", ...input.owner };
  if (input.matches.length === 1) {
    const match = input.matches[0];
    return { kind: "customer", name: match.name, shop: match.shop, businessId: match.businessId, customerId: match.id };
  }
  if (input.matches.length > 1) return { kind: "ambiguous" };
  return { kind: "unknown", profileName: input.profileName };
}

/** What to tell the model, in the user message (the shared instructions stay unchanged). */
export function chatPrompt(chat: ChatWith): string | null {
  if (chat.kind === "customer") {
    return `This WhatsApp chat is with ${chat.name}, a customer of ${chat.shop}. If the note does not name a different person, sales, payments, and questions about what they owe or bought are about ${chat.name}. Reply as if you are speaking to ${chat.name}.`;
  }
  if (chat.kind === "owner" && chat.about) {
    return `This WhatsApp chat is with ${chat.name}, the owner of ${chat.shop}. The customer this conversation is about is ${chat.about.name}. "He", "she", or a payment with no name means ${chat.about.name}, unless the note names someone else.`;
  }
  if (chat.kind === "owner") {
    return `This WhatsApp chat is with ${chat.name}, the owner of ${chat.shop}.`;
  }
  return null;
}

const NAMED = new Set(["sale", "payment", "question"]);

/** Fills in the person this chat is about when the note never names anyone. */
export function personalize(actions: Action[], chat: ChatWith): Action[] {
  const name = chat.kind === "customer" ? chat.name : chat.kind === "owner" ? chat.about?.name : undefined;
  if (!name) return actions;
  return actions.map((action) => {
    if (action.kind === "question" && action.topic === "owing" && chat.kind === "customer") {
      return { ...action, topic: "customer_balance", customer: name };
    }
    if (!NAMED.has(action.kind) || !("customer" in action) || action.customer?.trim()) return action;
    if (action.kind === "question" && action.topic !== "customer_balance" && action.topic !== "customer_purchases") return action;
    return { ...action, customer: name };
  });
}

/**
 * The customer an owner's chat should stay on. A name in the note switches to that person.
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

/** First line of a reply, so the chat is clearly about one person. */
export function chatHeading(chat: ChatWith, balance?: number): string | null {
  if (chat.kind === "customer") {
    const first = chat.name.split(/\s+/)[0];
    if (balance === undefined) return `Hi ${first}. This is BizBuddy for *${chat.shop}*.`;
    if (balance > 0) return `Hi ${first}. You still owe *${chat.shop}* ${formatNaira(balance)}.`;
    return `Hi ${first}. You don't owe *${chat.shop}* anything right now.`;
  }
  if (chat.kind === "owner" && chat.about) return `About *${chat.about.name}*`;
  if (chat.kind === "owner") return `Hi ${chat.name.split(/\s+/)[0]}.`;
  if (chat.kind === "ambiguous") return "This number is saved on more than one customer, so I won't guess who this chat is.";
  return null;
}
