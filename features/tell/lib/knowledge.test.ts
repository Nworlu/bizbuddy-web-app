import { describe, expect, it } from "vitest";
import { aboutSocials, knowledgeForPrompt, mergeCatalog, onlyLink, socialFromUrl, tidyLearned } from "./knowledge";

describe("what BizBuddy learns about the business", () => {
  it("tidies what the AI read: clipped names, whole-naira prices, no duplicates", () => {
    const learned = tidyLearned({ description: "  Used laptops  ", products: [{ name: "MacBook", price: 450000 }, { name: "macbook", price: 1 }, { name: "Bag", price: 12.5 }, { name: "" }] }, "your picture");
    expect(learned).toEqual({ description: "Used laptops", products: [{ name: "MacBook", price: 450000 }, { name: "Bag", price: null }], source: "your picture" });
  });

  it("recognises social links, and messages that are only a link", () => {
    expect(socialFromUrl("https://www.instagram.com/jaygadgets_ng/")).toEqual({ platform: "instagram", handle: "jaygadgets_ng" });
    expect(socialFromUrl("tiktok.com/@jay.gadgets")).toEqual({ platform: "tiktok", handle: "jay.gadgets" });
    expect(socialFromUrl("https://twitter.com/jaygadgets")).toEqual({ platform: "x", handle: "jaygadgets" });
    expect(socialFromUrl("x.com/@jaygadgets")).toEqual({ platform: "x", handle: "jaygadgets" });
    expect(socialFromUrl("https://jaygadgets.com")).toBeNull();
    expect(onlyLink("my site: jaygadgets.com")).toBe("jaygadgets.com");
    expect(onlyLink("Sold 2 shoes to David for 85k")).toBeNull();
  });

  it("adds confirmed products newest first, and gives the AI names only, never prices", () => {
    const merged = mergeCatalog([{ name: "Bag", price: 5000 }], "", { description: "Laptops", products: [{ name: "MacBook", price: 450000 }, { name: "bag", price: 6000 }], source: "x" });
    expect(merged.catalog.map((p) => p.name)).toEqual(["MacBook", "bag"]);
    const prompt = knowledgeForPrompt({ ...merged, socials: { instagram: "jay", x: "jaygadgets" } }).join(" ");
    expect(prompt).toContain("X (Twitter) @jaygadgets");
    expect(prompt).toContain("Products they list: MacBook, bag.");
    expect(prompt).toContain("Instagram @jay");
    expect(prompt).not.toContain("450");
  });

  it("answers a socials question from the handles that were saved", () => {
    expect(aboutSocials("Are you connected to my socials", {})).toContain("Not yet");
    expect(aboutSocials("Are you connected to my socials?", { instagram: "adafashion" })).toContain("@adafashion");
    expect(aboutSocials("Sold 2 shoes for 20k", { instagram: "adafashion" })).toBeNull();
  });
});
