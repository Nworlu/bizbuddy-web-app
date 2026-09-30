import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Action } from "@/features/tell/lib/intents";
import { EMPTY_MEMORY, type ShopMemory } from "@/features/tell/lib/memory";
import { demoData } from "@/shared/lib/demo";
import { customerTotals } from "@/shared/lib/finance";
import type { BizData } from "@/shared/lib/types";
import { handleMessage, type Deps, type Pending, type TellInput } from "./conversation";
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
  let script: Action[] | Error = [];

  const deps: Deps = {
    markSeen: async (id) => (seen.has(id) ? false : (seen.add(id), true)),
    whoIsChatting: async (phone): Promise<ChatWith> =>
      phone === OWNER ? { kind: "owner", name: "Ada Obi", shop: "Ada's Fashion", businessId: "shop-1", about: about ? { id: about.customerId, name: about.name } : null } : { kind: "unknown", profileName: null },
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
    expect(w.pending.size).toBe(0);
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
