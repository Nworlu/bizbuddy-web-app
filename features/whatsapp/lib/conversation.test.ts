import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Action } from "@/features/tell/lib/intents";
import { EMPTY_MEMORY, type ShopMemory } from "@/features/tell/lib/memory";
import { demoData } from "@/shared/lib/demo";
import { customerTotals } from "@/shared/lib/finance";
import type { BizData } from "@/shared/lib/types";
import { handleMessage, reminderFor, type Deps, type Pending, type TellInput } from "./conversation";
import type { ChatWith } from "./person";

const OWNER = "2348031234567";
const BUSY = new Error("busy");

/** A pretend server: one shop's books, the WhatsApp tables, and a scripted AI. */
function world() {
  let books: BizData = demoData();
  let memory: ShopMemory = EMPTY_MEMORY;
  let about: { businessId: string; customerId: string; name: string } | null = null;
  const pending = new Map<string, Pending>();
  const seen = new Set<string>();
  const sent: { to: string; body: string; buttons: string[] }[] = [];
  const asked: TellInput[] = [];
  const typing: string[] = [];
  let script: Action[] | Error = [];

  const deps: Deps = {
    markSeen: async (id) => (seen.has(id) ? false : (seen.add(id), true)),
    whoIsChatting: async (phone) => {
      const chat: ChatWith =
        phone === OWNER ? { kind: "owner", name: "Ada Obi", shop: "Ada's Fashion", businessId: "shop-1", about: about ? { id: about.customerId, name: about.name } : null } : { kind: "unknown", profileName: null };
      return { chat, books: chat.kind === "owner" ? books : null };
    },
    showTyping: async (id) => void typing.push(id),
    loadBooks: async () => books,
    saveChanges: async (_id, _before, after) => void (books = after),
    getPending: async (phone) => pending.get(phone) ?? null,
    setPending: async (phone, p) => void pending.set(phone, p),
    clearPending: async (phone) => void pending.delete(phone),
    setAbout: async (_phone, next) => void (about = next),
    getMemory: async () => memory,
    saveMemory: async (_id, next) => void (memory = next),
    interpret: async (input) => {
      asked.push(input);
      if (script instanceof Error) throw script;
      return { actions: script };
    },
    isBusy: (error) => error === BUSY,
    send: async (to, body, buttons = []) => void sent.push({ to, body, buttons: buttons.map((b) => b.title) }),
    appUrl: "https://bizbuddy.example",
    now: () => new Date(2026, 8, 30, 12),
  };

  let n = 0;
  return {
    deps,
    books: () => books,
    memory: () => memory,
    pending,
    sent,
    asked,
    typing,
    last: () => sent[sent.length - 1],
    script: (next: Action[] | Error) => void (script = next),
    say: (text: string, from = OWNER) => handleMessage({ id: `m${++n}`, from, text }, deps),
    tap: (buttonId: string, from = OWNER) => handleMessage({ id: `m${++n}`, from, buttonId }, deps),
  };
}

const sale = (over: Partial<Extract<Action, { kind: "sale" }>> = {}): Action => ({
  kind: "sale", customer: "David Okafor", product: "Cap", quantity: null, unit_price: null, total_amount: 10000, amount_paid: 4000, method: null, date: null, ...over,
});

beforeEach(() => vi.useFakeTimers({ now: new Date(2026, 8, 30, 12), toFake: ["Date"] }));
afterEach(() => vi.useRealTimers());

describe("who is chatting", () => {
  it("tells a number without an account how to sign up, and never reads the note", async () => {
    const w = world();
    await w.say("Sold shoes", "2348099999999");
    expect(w.last().body).toContain("isn't linked to a BizBuddy account");
    expect(w.last().body).toContain("https://bizbuddy.example");
    expect(w.asked).toHaveLength(0);
  });

  it("handles a message WhatsApp delivers twice only once", async () => {
    const w = world();
    w.script([sale()]);
    await handleMessage({ id: "same", from: OWNER, text: "Sold a cap" }, w.deps);
    await handleMessage({ id: "same", from: OWNER, text: "Sold a cap" }, w.deps);
    expect(w.sent).toHaveLength(1);
  });

  it("greets the owner who taps the welcome message's button", async () => {
    const w = world();
    await w.tap("Hi BizBuddy");
    expect(w.last().body).toContain("Hi Ada. This is BizBuddy for *Ada's Fashion*.");
    expect(w.last().body).toContain("Tell me what happened");
    expect(w.asked).toHaveLength(0);
  });

  it("shows typing straight away, before reading the note", async () => {
    const w = world();
    w.script([sale()]);
    await w.say("Sold a cap");
    expect(w.typing).toEqual(["m1"]);
  });

  it("still replies if the typing indicator fails", async () => {
    const w = world();
    w.deps.showTyping = async () => {
      throw new Error("Meta said no");
    };
    w.script([sale()]);
    await w.say("Sold a cap");
    expect(w.last().buttons).toEqual(["Save", "Cancel"]);
  });

  it("says it only reads text for now", async () => {
    const w = world();
    await handleMessage({ id: "v1", from: OWNER, other: "audio" }, w.deps);
    expect(w.last().body).toContain("I can only read text messages for now");
  });
});

describe("recording a sale", () => {
  it("shows the app's sums with Save and Cancel, and records only after Save", async () => {
    const w = world();
    const before = customerTotals("c1", w.books()).balance;
    w.script([sale({ total_amount: 85000, amount_paid: 50000, product: "Sneakers", quantity: 2 })]);
    await w.say("Sold 2 sneakers to David for 85k, he paid 50k");
    expect(w.last().body).toContain("Total ₦85,000 · Paid ₦50,000");
    expect(w.last().body).toContain("Still owes ₦35,000");
    expect(w.last().buttons).toEqual(["Save", "Cancel"]);
    expect(customerTotals("c1", w.books()).balance).toBe(before); // nothing saved yet

    await w.tap("save");
    expect(w.last().body).toBe("✓ Sale recorded. David Okafor still owes ₦35,000.\nIt's in your books; the app shows it next time it syncs.");
    expect(customerTotals("c1", w.books()).balance).toBe(before + 35000);
    expect(w.pending.size).toBe(0);
    expect(w.memory().products).toContain("Sneakers (2)");
  });

  it("gives the AI the customers, today in Lagos, and who the chat is with", async () => {
    const w = world();
    w.script([sale()]);
    await w.say("Sold a cap to David for 10k");
    expect(w.asked[0]).toMatchObject({ today: "2026-09-30", weekday: "Wednesday" });
    expect(w.asked[0].customers).toContain("David Okafor");
    expect(w.asked[0].chatWith).toContain("Ada's Fashion");
  });

  it("Cancel (or typing no) saves nothing", async () => {
    const w = world();
    const sales = w.books().sales.length;
    w.script([sale()]);
    await w.say("Sold a cap");
    await w.say("no");
    expect(w.last().body).toBe("Okay, I didn't save that.");
    expect(w.books().sales).toHaveLength(sales);
  });

  it("asks for what's missing instead of offering Save", async () => {
    const w = world();
    w.script([sale({ total_amount: null, amount_paid: null })]);
    await w.say("Sold a cap to David");
    expect(w.last().body).toContain("How much was the sale?");
    expect(w.last().buttons).toEqual([]);
    expect(w.pending.get(OWNER)).toMatchObject({ drafts: [], asking: "How much was the sale? Whole naira, like 85000." });
  });

  it("reads a short answer together with the note it was asked about", async () => {
    const w = world();
    w.script([sale({ customer: null })]);
    await w.say("Sold a cap for 10k");
    expect(w.last().body).toContain("Who bought it?");
    w.script([sale()]);
    await w.say("David");
    expect(w.asked[1].message).toBe("Sold a cap for 10k\n(Who bought it? David)");
    expect(w.last().buttons).toEqual(["Save", "Cancel"]);
  });

  it("treats a long reply to a question as a new note", async () => {
    const w = world();
    w.script([sale({ customer: null })]);
    await w.say("Sold a cap for 10k");
    w.script([{ kind: "expense", category: "Delivery", amount: 3000, description: "Rider", spent_by: null, date: null }]);
    await w.say("Actually forget that, I paid 3k for the dispatch rider to Lekki today");
    expect(w.asked[1].message).toBe("Actually forget that, I paid 3k for the dispatch rider to Lekki today");
  });

  it("says so when a new note replaces one that was never saved or cancelled", async () => {
    const w = world();
    w.script([sale()]);
    await w.say("Sold a cap to David for 10k");
    w.script([{ kind: "expense", category: "Delivery", amount: 3000, description: "Rider", spent_by: null, date: null }]);
    await w.say("Paid 3k for delivery");
    expect(w.sent.some((m) => m.body === "(Your earlier note wasn't saved: _Sold a cap to David for 10k_. Send it again if you want it.)")).toBe(true);
    expect(w.pending.get(OWNER)?.drafts).toHaveLength(1);
    expect(w.pending.get(OWNER)?.drafts[0].kind).toBe("expense");
  });

  it("Save with nothing waiting says so", async () => {
    const w = world();
    await w.say("yes");
    expect(w.last().body).toContain("Nothing is waiting to be saved.");
  });

  it("checks again at Save: a payment the books no longer allow isn't recorded", async () => {
    const w = world();
    w.script([{ kind: "payment", customer: "Sarah Ibrahim", amount: 20000, method: "Cash", date: null }]);
    await w.say("Sarah paid 20k");
    expect(w.last().buttons).toEqual(["Save", "Cancel"]);
    // Meanwhile, another phone recorded Sarah paying everything.
    const s6 = w.books().sales.find((s) => s.id === "s6")!;
    await w.deps.saveChanges("shop-1", w.books(), { ...w.books(), payments: [...w.books().payments, { id: "x", saleId: s6.id, customerId: "c2", amount: 20000, method: "Cash", date: "2026-09-30", createdAt: "x" }] });
    await w.tap("save");
    expect(w.last().body).toBe("Not saved: Sarah Ibrahim didn't owe anything then.");
  });
});

describe("money that could go either way", () => {
  const either: Action = { kind: "either", person: "Mordecai", what: "Laptop", amount: 85000, price: 450000, category: "Stock", method: "Bank Transfer", date: null };

  it("shows both readings and asks, without saving anything", async () => {
    const w = world();
    const expenses = w.books().expenses.length;
    w.script([either]);
    await w.say("Mordecai sent 85k for laptop of 450k");
    expect(w.last().body).toContain("Did Mordecai pay you, or spend it for the shop?");
    expect(w.last().body).toContain("*If Mordecai paid you (a sale):*");
    expect(w.last().body).toContain("*If Mordecai spent it for the shop (an expense):*");
    expect(w.last().buttons).toEqual(["Save as sale", "Save as expense", "Cancel"]);
    expect(w.books().expenses).toHaveLength(expenses);
  });

  it("Save as expense records the expense and remembers Mordecai is on the team", async () => {
    const w = world();
    const expenses = w.books().expenses.length;
    w.script([either]);
    await w.say("Mordecai sent 85k for laptop of 450k");
    await w.tap("save-expense");
    expect(w.last().body).toContain("✓ Expense recorded. Stock: ₦85,000.");
    expect(w.books().expenses).toHaveLength(expenses + 1);
    expect(w.books().expenses.at(-1)?.description).toBe("Laptop, paid by Mordecai");
    expect(w.memory().team).toEqual(["Mordecai"]);
    expect(w.pending.size).toBe(0);
  });

  it("Save as sale records a sale to Mordecai, who then owes the rest", async () => {
    const w = world();
    w.script([either]);
    await w.say("Mordecai sent 85k for laptop of 450k");
    await w.tap("save-sale");
    expect(w.last().body).toContain("✓ Sale recorded. Mordecai still owes ₦365,000.");
    expect(w.books().customers.some((c) => c.name === "Mordecai")).toBe(true);
  });

  it("a plain yes asks which one, and keeps it waiting", async () => {
    const w = world();
    w.script([either]);
    await w.say("Mordecai sent 85k for laptop of 450k");
    await w.say("yes");
    expect(w.last().body).toBe("Which is it? Tap *Save as sale* or *Save as expense*.");
    expect(w.last().buttons).toEqual(["Save as sale", "Save as expense", "Cancel"]);
    await w.say("expense");
    expect(w.last().body).toContain("✓ Expense recorded.");
  });
});

describe("auto-save", () => {
  it("offers it once the owner has saved enough notes in a row as read", async () => {
    const w = world();
    for (let i = 0; i < 10; i++) {
      w.script([sale({ total_amount: 1000, amount_paid: 1000 })]);
      await w.say(`Sold a cap to David for 1k (${i})`);
      await w.tap("save");
    }
    expect(w.last().body).toContain("I've read your last 10 notes right.");
    expect(w.last().buttons).toEqual(["Yes, auto-save", "No, keep asking"]);
    expect(w.memory().autoSave).toBe("offered");
    await w.tap("autosave-on");
    expect(w.memory().autoSave).toBe("on");
  });

  it("a cancel starts the count again", async () => {
    const w = world();
    w.script([sale()]);
    await w.say("Sold a cap");
    await w.tap("save");
    expect(w.memory().streak).toBe(1);
    await w.say("Sold a cap again");
    await w.tap("cancel");
    expect(w.memory().streak).toBe(0);
  });

  it("when on, saves a safe note straight away, and Undo takes it back out", async () => {
    const w = world();
    await w.say("auto-save on");
    const sales = w.books().sales.length;
    w.script([sale()]);
    await w.say("Sold a cap to David for 10k");
    expect(w.last().body).toContain("✓ Sale recorded.");
    expect(w.last().body).toContain("Saved without asking.");
    expect(w.last().buttons).toEqual(["Undo"]);
    expect(w.books().sales).toHaveLength(sales + 1);

    await w.tap("undo");
    expect(w.last().body).toContain("↩️ Undone.");
    expect(w.books().sales).toHaveLength(sales);
    await w.say("undo");
    expect(w.last().body).toContain("Nothing to undo here.");
  });

  it("when on, still asks about a payment and a new customer", async () => {
    const w = world();
    await w.say("auto-save on");
    w.script([{ kind: "payment", customer: "Sarah Ibrahim", amount: 5000, method: "Cash", date: null }]);
    await w.say("Sarah paid 5k");
    expect(w.last().buttons).toEqual(["Save", "Cancel"]);
    w.script([sale({ customer: "Mordecai" })]);
    await w.say("Sold a cap to Mordecai for 10k");
    expect(w.last().buttons).toEqual(["Save", "Cancel"]);
  });

  it("typing auto-save off turns it off", async () => {
    const w = world();
    await w.say("auto-save on");
    await w.say("auto-save off");
    expect(w.memory().autoSave).toBe("declined");
    expect(w.last().body).toContain("I'll show you every note before saving.");
  });
});

describe("reminders", () => {
  it("a question while a note is waiting answers it, then reminds them with the buttons", async () => {
    const w = world();
    w.script([sale()]);
    await w.say("Sold a cap to David for 10k");
    w.script([{ kind: "question", topic: "owing", customer: null, period: "month" }]);
    await w.say("Who owes me?");
    expect(w.last().body).toContain("⏰ You haven't saved or cancelled this yet: _Sold a cap to David for 10k_");
    expect(w.last().buttons).toEqual(["Save", "Cancel"]);
    expect(w.pending.get(OWNER)?.drafts).toHaveLength(1);
  });

  it("builds the timed reminder with the same buttons, and nothing when no tap is waiting", async () => {
    const w = world();
    w.script([sale()]);
    await w.say("Sold a cap to David for 10k");
    const reminder = reminderFor(w.pending.get(OWNER)!, w.books());
    expect(reminder?.body).toContain("*Sale* · David Okafor · Cap");
    expect(reminder?.buttons.map((b) => b.title)).toEqual(["Save", "Cancel"]);
    expect(reminderFor({ businessId: "shop-1", note: "x", drafts: [], asking: "Who bought it?" }, w.books())).toBeNull();
  });
});

describe("questions and follow-ups", () => {
  it("answers questions from the books, without Save", async () => {
    const w = world();
    w.script([{ kind: "question", topic: "owing", customer: null, period: "month" }]);
    await w.say("Who owes me?");
    expect(w.last().body).toContain("3 customers owe you money:");
    expect(w.last().body).toContain("*Total outstanding: ₦60,000*");
    expect(w.last().buttons).toEqual([]);
  });

  it("\"he paid\" after naming a customer goes to that customer", async () => {
    const w = world();
    w.script([sale({ customer: "Chinedu Eze" })]);
    await w.say("Sold a cap to Chinedu for 10k");
    await w.tap("save");
    w.script([{ kind: "payment", customer: null, amount: 5000, method: "Cash", date: null }]);
    await w.say("he paid 5k");
    expect(w.asked[1].chatWith).toContain("Chinedu Eze");
    expect(w.last().body).toContain("*Payment* · Chinedu Eze · ₦5,000");
  });

  it("says when the AI is busy, without saving anything", async () => {
    const w = world();
    w.script(BUSY);
    await w.say("Sold a cap");
    expect(w.last().body).toBe("I'm busy right now. Send that again in a minute.");
    expect(w.pending.size).toBe(0);
  });
});
