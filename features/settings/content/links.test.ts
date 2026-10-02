import { describe, expect, it } from "vitest";
import { settingsLinks } from "./links";

describe("settingsLinks", () => {
  it("is a short list, and hides account pages until they apply", () => {
    const signedOut = settingsLinks({ accounts: true, signedIn: false, demo: false }).map((link) => link.label);
    expect(signedOut).toEqual(["Account", "Business", "Records", "Chat", "Start over"]);
    const signedIn = settingsLinks({ accounts: true, signedIn: true, demo: false }).map((link) => link.label);
    expect(signedIn).toEqual(["Account", "Business", "Reminders", "Your shop", "Records", "Chat"]);
    expect(settingsLinks({ accounts: true, signedIn: true, demo: true }).map((link) => link.label)).toEqual(["Business", "Records", "Chat"]);
  });
});
