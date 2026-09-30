import { describe, expect, it } from "vitest";
import type { Action } from "@/features/tell/lib/intents";
import { chatHeading, chatPrompt, nextAbout, personalize, resolveChat } from "./person";

const david = { id: "c1", name: "David Okafor" };
const sarah = { id: "c2", name: "Sarah Ibrahim" };
const owner = { name: "Ada", shop: "Ada's Fashion", businessId: "b1", about: null as { id: string; name: string } | null };

describe("resolveChat", () => {
  it("treats the shop owner's number as the owner of that shop", () => {
    expect(resolveChat({ owner, profileName: "Ada" })).toMatchObject({ kind: "owner", name: "Ada", shop: "Ada's Fashion" });
  });

  it("does not open a chat for a number that is not the owner's account", () => {
    expect(resolveChat({ owner: null, profileName: "David" }).kind).toBe("unknown");
  });
});

describe("personalize", () => {
  const paid: Action = { kind: "payment", customer: null, amount: 20000, method: "Bank Transfer", date: null };

  it("keeps an owner's note on the customer they were recording", () => {
    const chat = resolveChat({ owner: { ...owner, about: david }, profileName: null });
    expect(personalize([paid], chat)[0]).toMatchObject({ customer: "David Okafor" });
  });

  it("keeps a name they did say", () => {
    const chat = resolveChat({ owner: { ...owner, about: david }, profileName: null });
    const named: Action = { ...paid, customer: "Sarah Ibrahim" };
    expect(personalize([named], chat)).toEqual([named]);
  });
});

describe("nextAbout", () => {
  it("switches to the one customer named in the note", () => {
    expect(nextAbout([{ kind: "payment", customer: "sarah ibrahim", amount: 5000, method: null, date: null }], [david, sarah])).toEqual(sarah);
  });

  it("leaves the current person when nobody new is named", () => {
    expect(nextAbout([{ kind: "payment", customer: null, amount: 5000, method: null, date: null }], [david])).toBeUndefined();
  });
});

describe("chatHeading", () => {
  it("greets the owner about their shop", () => {
    const chat = resolveChat({ owner, profileName: null });
    expect(chatHeading(chat)).toBe("Hi Ada. This is BizBuddy for *Ada's Fashion*.");
    expect(chatPrompt(chat)).toContain("run the shop");
  });
});
