// Answers the V0.1 questions (BIZBUDDY_PLAN.md §13): sales, expenses, and who owes money.
// This is keyword matching, not AI. Every number comes from shared/lib/finance.ts.

import { PERIODS, periodRange, type Period } from "@/shared/lib/dates";
import { customerTotals, customersOwing, expenseSummary, periodSummary } from "@/shared/lib/finance";
import { formatNaira } from "@/shared/lib/format";
import type { BizData, Customer } from "@/shared/lib/types";
import { routes } from "@/shared/lib/routes";

export interface Answer {
  text: string;
  rows?: { label: string; value: string; href?: string }[];
  total?: { label: string; value: string };
  link?: { label: string; href: string };
  /** Questions the user can tap to ask next. */
  suggestions?: string[];
}

export const SUGGESTIONS = ["Who owes me?", "How much did I sell this month?", "How much did I spend this month?"];

const has = (q: string, words: string[]) => words.some((w) => new RegExp(`\\b${w}`).test(q));

/** "today", "this week", "last month"… Defaults to this month, as in the plan's examples. */
function periodIn(q: string): Period {
  if (/\btoday\b/.test(q)) return "today";
  if (/\b(this|past) week\b/.test(q)) return "week";
  if (/\blast month\b/.test(q)) return "last-month";
  return "month";
}

function periodText(period: Period) {
  return PERIODS.find((p) => p.key === period)!.label.toLowerCase();
}

/** Customers named in the question: full name first, then first name alone (which may match several people). */
function customersIn(q: string, customers: Customer[]): Customer[] {
  const words = (name: string) => name.toLowerCase().split(/\s+/).filter(Boolean);
  const mentions = (phrase: string) => phrase.length >= 3 && new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(q);
  const full = customers.filter((c) => mentions(words(c.name).join(" ")));
  if (full.length > 0) return full;
  return customers.filter((c) => mentions(words(c.name)[0] ?? ""));
}

export function answerQuestion(question: string, data: BizData, now = new Date()): Answer {
  const q = question.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();
  const period = periodIn(q);
  const range = periodRange(period, now);
  const when = periodText(period);

  const named = customersIn(q, data.customers);
  const aboutDebt = has(q, ["owe", "owing", "debt", "balance", "outstanding"]);
  if (named.length === 1 && !aboutDebt && has(q, ["buy", "bought", "sell", "sold", "sale"])) {
    const c = named[0];
    const { totalSales, totalPaid } = customerTotals(c.id, data);
    return {
      text: totalSales > 0 ? `${c.name} has bought ${formatNaira(totalSales)} from you in total, and paid ${formatNaira(totalPaid)}.` : `${c.name} hasn't bought anything yet.`,
      link: { label: `Open ${c.name}`, href: routes.customer(c.id) },
    };
  }
  if (named.length > 0 && (aboutDebt || has(q, ["pay", "paid", "much"]))) {
    if (named.length === 1) {
      const c = named[0];
      const { balance, totalSales } = customerTotals(c.id, data);
      return {
        text: balance > 0 ? `${c.name} owes you ${formatNaira(balance)}.` : totalSales > 0 ? `${c.name} has paid everything. They owe you nothing.` : `${c.name} hasn't bought anything yet.`,
        link: { label: `Open ${c.name}`, href: routes.customer(c.id) },
      };
    }
    return {
      text: `You have ${named.length} customers with that name:`,
      rows: named.map((c) => ({ label: c.name, value: `owes ${formatNaira(customerTotals(c.id, data).balance)}`, href: routes.customer(c.id) })),
    };
  }

  if (aboutDebt) {
    const owing = customersOwing(data);
    if (owing.length === 0) return { text: "Nobody owes you money right now." };
    return {
      text: owing.length === 1 ? "One customer owes you money:" : `${owing.length} customers owe you money:`,
      rows: owing.map(({ customer, balance }) => ({ label: customer.name, value: formatNaira(balance), href: routes.customer(customer.id) })),
      total: { label: "Total outstanding", value: formatNaira(owing.reduce((sum, x) => sum + x.balance, 0)) },
      link: { label: "See all customers", href: "/customers" },
    };
  }

  if (has(q, ["sell", "sold", "sale", "revenue", "income"])) {
    const count = data.sales.filter((s) => s.date >= range.start && s.date <= range.end).length;
    const summary = periodSummary(data, range);
    if (count === 0) return { text: `You haven't recorded any sales ${when}.`, link: { label: "Record a sale", href: "/sales/new" } };
    return {
      text: `You recorded ${formatNaira(summary.sales)} in sales ${when}, across ${count} sale${count === 1 ? "" : "s"}. You collected ${formatNaira(summary.collected)} ${when}.`,
      link: { label: "See all sales", href: "/sales" },
    };
  }

  if (has(q, ["spend", "spent", "expense", "cost"])) {
    const { total, byCategory, expenses } = expenseSummary(data, range);
    if (expenses.length === 0) return { text: `You haven't recorded any expenses ${when}.`, link: { label: "Record an expense", href: "/expenses/new" } };
    return {
      text: `You recorded ${formatNaira(total)} in expenses ${when}.`,
      rows: byCategory.map(({ category, amount }) => ({ label: category, value: formatNaira(amount) })),
      link: { label: "See all expenses", href: "/expenses" },
    };
  }

  if (has(q, ["collect", "received", "came in"])) {
    const { collected } = periodSummary(data, range);
    return { text: `You collected ${formatNaira(collected)} ${when}, including payments on older sales.` };
  }

  return {
    text: "I can answer questions about your sales, your expenses, and who owes you. Try one of these:",
    suggestions: SUGGESTIONS,
  };
}
