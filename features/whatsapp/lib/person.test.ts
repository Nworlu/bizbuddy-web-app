import { describe, expect, it } from "vitest";
import type { Action } from "@/features/tell/lib/intents";
import { chatHeading, chatPrompt, customersOnPhone, nextAbout, personalize, resolveChat, type KnownCustomer } from "./person";

const david: KnownCustomer = { id: "c1", name: "David Okafor", phone: "0803 123 4567", businessId: "b1", shop: "Ada's Fashion" };
const sarah: KnownCustomer = { id: "c2", name: "Sarah Ibrahim", phone: "08051234567", businessId: "b1", shop: "Ada's Fashion" };

describe("customersOnPhone", () => {
  it("matches a WhatsApp number to the phone saved on the customer", () => {
    expect(customersOnPhone([david, sarah], "2348031234567")).toEqual([david]);
    expect(customersOnPhone([david], "08039999999")).toEqual([]);
  });
});

describe("resolveChat", () => {
  const owner = { name: "Ada", shop: "Ada's Fashion", businessId: "b1", about: null };

  it("treats the shop owner's number as the owner, even if a customer has it too", () => {
    expect(resolveChat({ owner, matches: [david], profileName: "Ada" }).kind).toBe("owner");
  });

  it("treats a saved customer number as that customer", () => {
    expect(resolveChat({ owner: null, matches: [david], profileName: "Dave" })).toMatchObject({ kind: "customer", name: "David Okafor", shop: "Ada's Fashion" });
  });

  it("does not guess when the number is on more than one customer", () => {
    expect(resolveChat({ owner: null, matches: [david, { ...sarah, phone: david.phone }], profileName: null }).kind).toBe("ambiguous");
  });
});

describe("personalize", () => {
  const paid: Action = { kind: "payment", customer: null, amount: 20000, method: "Bank Transfer", date: null };

  it("fills the customer's own name when they don't say it", () => {
    const chat = resolveChat({ owner: null, matches: [david], profileName: null });
    expect(personalize([paid, { kind: "question", topic: "owing", customer: null, period: "month" }], chat)).toEqual([
      { ...paid, customer: "David Okafor" },
      { kind: "question", topic: "customer_balance", customer: "David Okafor", period: "month" },
    ]);
  });

  it("keeps a name they did say", () => {
    const chat = resolveChat({ owner: null, matches: [david], profileName: null });
    const named: Action = { ...paid, customer: "Sarah Ibrahim" };
    expect(personalize([named], chat)).toEqual([named]);
  });

  it("keeps an owner's chat on the customer they were talking about", () => {
    const chat = resolveChat({ owner: { name: "Ada", shop: "Ada's Fashion", businessId: "b1", about: { id: "c1", name: "David Okafor" } }, matches: [], profileName: null });
    expect(personalize([paid], chat)[0]).toMatchObject({ customer: "David Okafor" });
  });
});

describe("nextAbout", () => {
  it("switches to the one customer named in the note", () => {
    expect(nextAbout([{ kind: "payment", customer: "sarah ibrahim", amount: 5000, method: null, date: null }], [david, sarah])).toEqual({ id: "c2", name: "Sarah Ibrahim" });
  });

  it("leaves the current person when nobody new is named", () => {
    expect(nextAbout([{ kind: "payment", customer: null, amount: 5000, method: null, date: null }], [david])).toBeUndefined();
  });
});

describe("chatHeading", () => {
  it("speaks to the customer about what they owe", () => {
    const chat = resolveChat({ owner: null, matches: [david], profileName: null });
    expect(chatHeading(chat, 35000)).toBe("Hi David. You still owe *Ada's Fashion* ₦35,000.");
    expect(chatHeading(chat, 0)).toBe("Hi David. You don't owe *Ada's Fashion* anything right now.");
  });

  it("tells the owner which customer the chat is about", () => {
    const chat = resolveChat({ owner: { name: "Ada", shop: "Ada's Fashion", businessId: "b1", about: { id: "c1", name: "David Okafor" } }, matches: [], profileName: null });
    expect(chatHeading(chat)).toBe("About *David Okafor*");
    expect(chatPrompt(chat)).toContain("David Okafor");
  });
});
