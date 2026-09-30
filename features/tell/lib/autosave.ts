// Saving without asking, once BizBuddy has shown it understands the shop.
//
// Every note is shown as a draft to confirm. After AUTO_SAVE_AFTER drafts in a row saved exactly as
// BizBuddy read them, it offers (once) to save notes like these straight away. Even then it still asks
// about anything it could get badly wrong: sale-or-expense, a new customer, a payment, or an amount far
// bigger than this shop's usual. Every auto-save can be undone. Pure: used by WhatsApp and Tell BizBuddy.

import { findCustomerByName } from "@/shared/lib/actions";
import type { BizData, LocalDate } from "@/shared/lib/types";
import { checkDraft } from "./drafts";
import type { Draft } from "./intents";
import type { AutoSave, ShopMemory } from "./memory";

export const AUTO_SAVE_AFTER = 10;
/** Fewer records than this of a kind, and BizBuddy doesn't know the shop's usual amounts yet. */
const HISTORY = 5;
const RECENT = 30;

/** What happened to a draft BizBuddy showed. "auto" was saved without asking, so it proves nothing new. */
export type Review = "saved" | "corrected" | "cancelled" | "undone" | "auto";
export const REVIEWS: readonly Review[] = ["saved", "corrected", "cancelled", "undone", "auto"];

export function reviewed(memory: ShopMemory, review: Review): ShopMemory {
  if (review === "auto") return memory;
  const streak = review === "saved" ? memory.streak + 1 : 0;
  return streak === memory.streak ? memory : { ...memory, streak };
}

/** Time to offer auto-save: enough right in a row, and never offered before. */
export function offerDue(memory: ShopMemory): boolean {
  return memory.autoSave === "off" && memory.streak >= AUTO_SAVE_AFTER;
}

export function withAutoSave(memory: ShopMemory, autoSave: AutoSave): ShopMemory {
  return memory.autoSave === autoSave ? memory : { ...memory, autoSave };
}

/** Much bigger than this shop's recent amounts of that kind: more than double the biggest. */
export function unusuallyBig(kind: "sale" | "expense", amount: number, data: BizData): boolean {
  const recent = kind === "sale" ? data.sales.slice(-RECENT).map((s) => s.totalAmount) : data.expenses.slice(-RECENT).map((e) => e.amount);
  if (recent.length < HISTORY) return true;
  return amount > 2 * Math.max(...recent);
}

/**
 * Why this draft still needs the owner's Save, or null when it can be saved straight away.
 * Only complete sales to existing customers and expenses, at ordinary amounts, are saved without asking.
 */
export function needsAsking(draft: Draft, data: BizData, today: LocalDate): string | null {
  if (checkDraft(draft, data, today)) return "incomplete";
  switch (draft.kind) {
    case "payment":
      return "payment";
    case "sale":
      if (!findCustomerByName(data, draft.customer)) return "new customer";
      return draft.total !== null && unusuallyBig("sale", draft.total, data) ? "big amount" : null;
    case "expense":
      return draft.amount !== null && unusuallyBig("expense", draft.amount, data) ? "big amount" : null;
  }
}

/** What an auto-save added, so Undo can take exactly that back out. */
export type Undo = { sales: string[]; expenses: string[] };

export function added(before: BizData, after: BizData): Undo {
  const sales = new Set(before.sales.map((s) => s.id));
  const expenses = new Set(before.expenses.map((e) => e.id));
  return { sales: after.sales.filter((s) => !sales.has(s.id)).map((s) => s.id), expenses: after.expenses.filter((e) => !expenses.has(e.id)).map((e) => e.id) };
}

/** The books without what an auto-save added: its sales (with every payment on them) and expenses. */
export function undo(data: BizData, what: Undo): BizData {
  const sales = new Set(what.sales);
  const expenses = new Set(what.expenses);
  return {
    ...data,
    sales: data.sales.filter((s) => !sales.has(s.id)),
    payments: data.payments.filter((p) => !sales.has(p.saleId)),
    expenses: data.expenses.filter((e) => !expenses.has(e.id)),
  };
}
