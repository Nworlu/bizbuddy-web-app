import { describe, expect, it } from "vitest";
import { continueTalk, remember, WHAT_YOU_CAN_ASK, type Turn } from "./thread";

const made: Turn[] = [
  { who: "owner", text: "How much did I make yesterday?" },
  { who: "bizbuddy", text: "You recorded ₦85,000 in sales yesterday." },
];

describe("continueTalk", () => {
  it("reads how much they made yesterday as sales", () => {
    expect(continueTalk("How much did I make yesterday?", [])).toMatchObject({ kind: "question", topic: "sales", period: "yesterday" });
  });

  it("keeps the last question when they only change the day", () => {
    expect(continueTalk("What of today?", made)).toMatchObject({ topic: "sales", period: "today" });
    expect(continueTalk("Okay what of last week?", made)).toMatchObject({ topic: "sales", period: "last-week" });
    expect(continueTalk("What of last month?", made)).toMatchObject({ topic: "sales", period: "last-month" });
  });

  it("breaks down who owes, after that question", () => {
    const turns: Turn[] = [
      { who: "owner", text: "Who owes me?" },
      { who: "bizbuddy", text: "2 customers owe you money." },
    ];
    expect(continueTalk("Can you break it down?", turns)).toMatchObject({ topic: "owing", detail: true });
    expect(continueTalk("I mean the money owed", turns)).toMatchObject({ topic: "owing", detail: true });
  });

  it("names the best customer", () => {
    expect(continueTalk("Who is my best customer?", [])).toMatchObject({ topic: "top_customer" });
  });

  it("says what they can ask", () => {
    expect(continueTalk("What question can I ask you?", [])).toEqual({ kind: "help" });
    expect(WHAT_YOU_CAN_ASK).toContain("who owes you");
  });

  it("remembers church when they say they already told you", () => {
    const turns = remember([], "I am going to church", "You said you're going to church.");
    const next = continueTalk("I just told you", turns);
    expect(next?.kind).toBe("chat");
    if (next?.kind === "chat") expect(next.reply).toContain("church");
  });

  it("leaves a sale for the reader", () => {
    expect(continueTalk("Sold 2 shoes to David for 85k, he paid 50k", made)).toBeNull();
  });
});
