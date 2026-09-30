// What "Tell BizBuddy" understands in a message, and how it becomes a draft the shop owner confirms.
//
// The model (OpenAI or Claude, see server/interpret.ts) only reads the message: it returns the actions
// below (structured output, so always in this shape). It never sees the books and never does the maths (BIZBUDDY_PLAN.md §18): a unit price and a
// quantity come back as they were said, and totals, balances, and answers are worked out here and in
// shared/lib/finance.ts. Nothing is saved until the owner taps Save on the draft.

import { EXPENSE_CATEGORIES, PAYMENT_METHODS, type ExpenseCategory, type LocalDate, type PaymentMethod } from "@/shared/lib/types";

export const QUESTION_TOPICS = ["owing", "customer_balance", "customer_purchases", "sales", "expenses", "collected"] as const;
export const QUESTION_PERIODS = ["today", "week", "month", "last-month"] as const;

export type SaleAction = {
  kind: "sale";
  customer: string | null;
  product: string | null;
  quantity: number | null;
  /** Price of one item, when the message gives it that way ("40k each"). */
  unit_price: number | null;
  /** Total for the whole sale, when the message says it. */
  total_amount: number | null;
  amount_paid: number | null;
  method: PaymentMethod | null;
  date: LocalDate | null;
};
export type ExpenseAction = { kind: "expense"; category: ExpenseCategory | null; amount: number | null; description: string | null; date: LocalDate | null };
export type PaymentAction = { kind: "payment"; customer: string | null; amount: number | null; method: PaymentMethod | null; date: LocalDate | null };
export type QuestionAction = { kind: "question"; topic: (typeof QUESTION_TOPICS)[number]; customer: string | null; period: (typeof QUESTION_PERIODS)[number] };
export type UnclearAction = { kind: "unclear"; reply: string };
export type Action = SaleAction | ExpenseAction | PaymentAction | QuestionAction | UnclearAction;

export interface Interpretation {
  actions: Action[];
}

// The JSON schema the model must answer in. Kept to what both OpenAI's and Claude's strict structured
// outputs accept: every object closed, every field required (nullable instead of optional), enum not const.

const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: "null" }] });
const naira = nullable({ type: "integer", description: "Whole naira. 85k = 85000, 1.2m = 1200000." });
const date = nullable({ type: "string", format: "date", description: "YYYY-MM-DD. null means today." });
const method = nullable({ type: "string", enum: [...PAYMENT_METHODS] });
const object = (properties: Record<string, unknown>) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });

export const INTERPRETATION_SCHEMA = object({
  actions: {
    type: "array",
    items: {
      anyOf: [
        object({
          kind: { type: "string", enum: ["sale"] },
          customer: nullable({ type: "string" }),
          product: nullable({ type: "string" }),
          quantity: nullable({ type: "integer" }),
          unit_price: naira,
          total_amount: naira,
          amount_paid: naira,
          method,
          date,
        }),
        object({
          kind: { type: "string", enum: ["expense"] },
          category: nullable({ type: "string", enum: [...EXPENSE_CATEGORIES] }),
          amount: naira,
          description: nullable({ type: "string" }),
          date,
        }),
        object({ kind: { type: "string", enum: ["payment"] }, customer: nullable({ type: "string" }), amount: naira, method, date }),
        object({
          kind: { type: "string", enum: ["question"] },
          topic: { type: "string", enum: [...QUESTION_TOPICS] },
          customer: nullable({ type: "string" }),
          period: { type: "string", enum: [...QUESTION_PERIODS] },
        }),
        object({ kind: { type: "string", enum: ["unclear"] }, reply: { type: "string" } }),
      ],
    },
  },
});

// Drafts: what the confirmation card shows -------------------------------------------------------------

/** A whole-naira amount above zero, or null. Guards against anything odd in the model's output. */
function money(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function dateOrToday(value: unknown, today: LocalDate): LocalDate {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : today;
}

export interface SaleDraft {
  kind: "sale";
  customer: string;
  product: string;
  total: number | null;
  paid: number;
  method: PaymentMethod;
  date: LocalDate;
}
export interface ExpenseDraft {
  kind: "expense";
  category: ExpenseCategory;
  amount: number | null;
  description: string;
  date: LocalDate;
}
export interface PaymentDraft {
  kind: "payment";
  customer: string;
  amount: number | null;
  method: PaymentMethod;
  date: LocalDate;
}
export type Draft = SaleDraft | ExpenseDraft | PaymentDraft;

/**
 * Turns an action into a draft with the arithmetic done here: total = unit price × quantity when the
 * total wasn't said. Unknown amounts stay null so the card asks for them; nothing is guessed.
 */
export function toDraft(action: SaleAction | ExpenseAction | PaymentAction, today: LocalDate): Draft {
  switch (action.kind) {
    case "sale": {
      const quantity = typeof action.quantity === "number" && Number.isSafeInteger(action.quantity) && action.quantity > 1 ? action.quantity : 1;
      const unit = money(action.unit_price);
      const total = money(action.total_amount) ?? (unit !== null ? unit * quantity : null);
      const product = (action.product ?? "").trim();
      return {
        kind: "sale",
        customer: (action.customer ?? "").trim(),
        product: product && quantity > 1 ? `${product} (${quantity})` : product,
        total,
        paid: money(action.amount_paid) ?? 0,
        method: action.method ?? "Cash",
        date: dateOrToday(action.date, today),
      };
    }
    case "expense":
      return { kind: "expense", category: action.category ?? "Other", amount: money(action.amount), description: (action.description ?? "").trim(), date: dateOrToday(action.date, today) };
    case "payment":
      return { kind: "payment", customer: (action.customer ?? "").trim(), amount: money(action.amount), method: action.method ?? "Cash", date: dateOrToday(action.date, today) };
  }
}

/** Reads the model's JSON. Throws if it isn't the expected shape (it should always be, with structured outputs). */
export function parseInterpretation(text: string): Interpretation {
  const value = JSON.parse(text) as Interpretation;
  if (!value || !Array.isArray(value.actions)) throw new Error("Unexpected interpretation");
  const kinds = new Set(["sale", "expense", "payment", "question", "unclear"]);
  return { actions: value.actions.filter((a) => a && kinds.has(a.kind)).slice(0, 10) };
}
