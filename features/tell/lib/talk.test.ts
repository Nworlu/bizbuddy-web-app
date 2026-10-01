import { describe, expect, it } from "vitest";
import { demoData } from "@/shared/lib/demo";
import { localTalk } from "./talk";

describe("Tell BizBuddy follows the chat", () => {
  it("answers how much they made, then today, from the books", () => {
    const first = localTalk("How much did I make yesterday?", [], demoData(), null, new Date(2026, 8, 30, 12));
    expect(first?.text).toMatch(/yesterday/);
    expect(first?.answer).toBeTruthy();
    const next = localTalk("What of today?", first!.turns, demoData(), null, new Date(2026, 8, 30, 12));
    expect(next?.text).toMatch(/today/);
  });

  it("answers socials from what was saved, and not before we know", () => {
    expect(localTalk("Are you connected to my socials", [], demoData(), null)).toBeNull();
    expect(localTalk("Are you connected to my socials", [], demoData(), {})?.text).toContain("Not yet");
    expect(localTalk("Are you connected to my socials?", [], demoData(), { instagram: "adafashion" })?.text).toContain("@adafashion");
  });

  it("leaves a sale for the reader", () => {
    expect(localTalk("Sold 2 shoes to David for 85k, he paid 50k", [], demoData(), {})).toBeNull();
  });
});
