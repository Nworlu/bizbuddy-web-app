// Checking, describing, and saving a draft from Tell BizBuddy. Used by the app's draft cards and by
// WhatsApp, so both say the same things and save by the same rules (shared/lib/actions.ts).

import { findCustomerByName, withCustomerPayment, withExpense, withSale } from "@/shared/lib/actions";
import { customerTotals, owedOn } from "@/shared/lib/finance";
import { formatDate, formatNaira } from "@/shared/lib/format";
import type { BizData, LocalDate } from "@/shared/lib/types";
import type { Draft } from "./intents";

/** What's missing or wrong with a draft, in words for the shop owner. null when it can be saved. */
export function checkDraft(draft: Draft, data: BizData, today: LocalDate): string | null {
  if (!draft.date || draft.date > today) return "The date can't be in the future.";
  switch (draft.kind) {
    case "sale":
      if (!draft.customer.trim()) return "Who bought it?";
      if (!draft.product.trim()) return "What did you sell?";
      if (draft.total === null) return "How much was the sale? Whole naira, like 85000.";
      if (draft.paid > draft.total) return "They can't pay more than the sale amount.";
      return null;
    case "expense":
      if (draft.amount === null) return "How much did you spend? Whole naira, like 4000.";
      return null;
    case "payment": {
      const match = draft.customer.trim() ? findCustomerByName(data, draft.customer) : undefined;
      if (!match) return draft.customer.trim() ? `${draft.customer.trim()} isn't one of your customers. Check the name.` : "Who paid?";
      if (draft.amount === null) return "How much did they pay? Whole naira, like 20000.";
      const owed = owedOn(match.id, data, draft.date);
      if (owed === 0) return `${match.name} didn't owe anything then.`;
      if (draft.amount > owed) return `${match.name} owed ${formatNaira(owed)}. The payment can't be more than that.`;
      return null;
    }
  }
}

/** A few lines saying what will be recorded, with the app's own sums. For WhatsApp's confirmation message. */
export function describeDraft(draft: Draft, data: BizData): string {
  const when = formatDate(draft.date);
  switch (draft.kind) {
    case "sale": {
      const existing = draft.customer.trim() ? findCustomerByName(data, draft.customer) : undefined;
      const who = existing?.name ?? (draft.customer.trim() ? `${draft.customer.trim()} (new customer)` : "?");
      const lines = [`*Sale* · ${who} · ${draft.product || "?"}`];
      if (draft.total === null) lines.push(`Total: ? · Paid: ${formatNaira(draft.paid)}`);
      else {
        lines.push(`Total ${formatNaira(draft.total)} · Paid ${formatNaira(draft.paid)}${draft.paid > 0 ? ` (${draft.method})` : ""}`);
        const owing = draft.total - draft.paid;
        lines.push(owing > 0 ? `Still owes ${formatNaira(owing)}` : "Paid in full");
      }
      lines.push(when);
      return lines.join("\n");
    }
    case "expense":
      return [`*Expense* · ${draft.category} · ${draft.amount === null ? "?" : formatNaira(draft.amount)}`, draft.description, when].filter(Boolean).join("\n");
    case "payment": {
      const match = draft.customer.trim() ? findCustomerByName(data, draft.customer) : undefined;
      const lines = [`*Payment* · ${match?.name ?? (draft.customer.trim() || "?")} · ${draft.amount === null ? "?" : formatNaira(draft.amount)} (${draft.method})`];
      if (match) {
        const owes = customerTotals(match.id, data).balance;
        lines.push(draft.amount !== null && draft.amount <= owes ? `Owes ${formatNaira(owes)} now, ${formatNaira(owes - draft.amount)} after this` : `Owes ${formatNaira(owes)} now`);
      }
      lines.push(when);
      return lines.join("\n");
    }
  }
}

/** Saves a checked draft into the books. Throws if it breaks a rule (callers check first). */
export function applyDraft(data: BizData, draft: Draft): { data: BizData; text: string; customerId?: string } {
  switch (draft.kind) {
    case "sale": {
      const result = withSale(data, { customerName: draft.customer, product: draft.product, totalAmount: draft.total ?? 0, amountPaid: draft.paid, method: draft.method, date: draft.date });
      return {
        data: result.data,
        text: `Sale recorded. ${result.outstanding > 0 ? `${result.customerName} still owes ${formatNaira(result.outstanding)}.` : `${result.customerName} paid in full.`}`,
        customerId: findCustomerByName(result.data, result.customerName)?.id,
      };
    }
    case "expense": {
      const result = withExpense(data, { category: draft.category, amount: draft.amount ?? 0, description: draft.description, date: draft.date });
      return { data: result.data, text: `Expense recorded. ${draft.category}: ${formatNaira(result.expense.amount)}.` };
    }
    case "payment": {
      const match = findCustomerByName(data, draft.customer);
      if (!match) throw new Error("Customer not found");
      const owes = customerTotals(match.id, data).balance;
      const result = withCustomerPayment(data, { customerId: match.id, amount: draft.amount ?? 0, method: draft.method, date: draft.date });
      const left = owes - (draft.amount ?? 0);
      return { data: result.data, text: `Payment recorded. ${left > 0 ? `${match.name} still owes ${formatNaira(left)}.` : `${match.name} is paid up.`}`, customerId: match.id };
    }
  }
}
