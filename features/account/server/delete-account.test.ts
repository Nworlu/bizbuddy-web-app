import { describe, expect, it } from "vitest";
import { PHONE_ONLY_TABLES, removeAccount, type AccountAdmin } from "./delete-account";

function admin(overrides: Partial<AccountAdmin> = {}): AccountAdmin & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    deletePhoneRows: async (table, phone) => {
      calls.push(`rows ${table} ${phone}`);
      return "ok";
    },
    deleteUser: async (userId) => {
      calls.push(`user ${userId}`);
    },
    ...overrides,
  };
}

describe("removeAccount", () => {
  it("clears the phone-only rows, then deletes the user", async () => {
    const fake = admin();
    await removeAccount("user-1", "2348112959740", fake);
    expect(fake.calls).toEqual([...PHONE_ONLY_TABLES.map((table) => `rows ${table} 2348112959740`), "user user-1"]);
  });

  it("still deletes an account whose login has no phone", async () => {
    const fake = admin();
    await removeAccount("user-1", null, fake);
    expect(fake.calls).toEqual(["user user-1"]);
  });

  it("keeps going when a phone-only table is not there yet", async () => {
    const fake = admin({
      deletePhoneRows: async (table) => (table === "whatsapp_thread" ? "missing" : "ok"),
    });
    await removeAccount("user-1", "2348112959740", fake);
    expect(fake.calls).toEqual(["user user-1"]);
  });

  it("stops when the user cannot be deleted", async () => {
    const fake = admin({
      deleteUser: async () => {
        throw new Error("nope");
      },
    });
    await expect(removeAccount("user-1", "2348112959740", fake)).rejects.toThrow("nope");
  });
});
