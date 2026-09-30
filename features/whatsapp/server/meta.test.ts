import { describe, expect, it } from "vitest";
import { incomingMessages } from "./meta";

describe("incomingMessages", () => {
  it("keeps the WhatsApp profile name with the sender", () => {
    const [message] = incomingMessages({
      entry: [
        {
          changes: [
            {
              value: {
                contacts: [{ wa_id: "2348031234567", profile: { name: "David Okafor" } }],
                messages: [{ id: "m1", from: "2348031234567", type: "text", text: { body: "I paid 20k" } }],
              },
            },
          ],
        },
      ],
    });
    expect(message).toMatchObject({ from: "2348031234567", profileName: "David Okafor", text: "I paid 20k" });
  });
});
