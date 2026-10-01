import { describe, expect, it } from "vitest";
import { messageBelongsToPhone, PHONE_ONLY_TABLES, removeAccount, SHOP_TABLES, type AccountAdmin } from "./delete-account";

const PHONE = "2348112959740";

function admin(overrides: Partial<AccountAdmin> = {}): AccountAdmin & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    businessId: async () => {
      calls.push("business");
      return "shop-1";
    },
    deleteShopRows: async (table, businessId) => {
      calls.push(`shop ${table} ${businessId}`);
      return "ok";
    },
    deleteShop: async (businessId) => {
      calls.push(`shop-row ${businessId}`);
    },
    deletePhoneRows: async (table, phone) => {
      calls.push(`phone ${table} ${phone}`);
      return "ok";
    },
    seenMessageIds: async () => ["wamid.other", messageIdFor(PHONE), "plain"],
    deleteSeenMessages: async (ids) => {
      calls.push(`seen ${ids.join(",")}`);
    },
    deleteUser: async (userId) => {
      calls.push(`user ${userId}`);
    },
    ...overrides,
  };
}

function messageIdFor(phone: string): string {
  return `wamid.${Buffer.from(`from ${phone} ok`, "utf8").toString("base64url")}`;
}

describe("removeAccount", () => {
  it("deletes the shop, its rows, the phone's chat, matching message ids, then the user", async () => {
    const fake = admin();
    await removeAccount("user-1", PHONE, fake);
    expect(fake.calls).toEqual([
      "business",
      ...SHOP_TABLES.map((table) => `shop ${table} shop-1`),
      "shop-row shop-1",
      ...PHONE_ONLY_TABLES.map((table) => `phone ${table} ${PHONE}`),
      `seen ${messageIdFor(PHONE)}`,
      "user user-1",
    ]);
  });

  it("still deletes an account that never made a shop and has no phone", async () => {
    const fake = admin({
      businessId: async () => null,
    });
    await removeAccount("user-1", null, fake);
    expect(fake.calls).toEqual(["user user-1"]);
  });

  it("keeps going when a phone-only table is not there yet", async () => {
    const fake = admin({
      businessId: async () => null,
      deletePhoneRows: async (table) => (table === "whatsapp_thread" ? "missing" : "ok"),
      seenMessageIds: async () => [],
    });
    await removeAccount("user-1", PHONE, fake);
    expect(fake.calls).toEqual(["user user-1"]);
  });

  it("stops when the user cannot be deleted", async () => {
    const fake = admin({
      deleteUser: async () => {
        throw new Error("nope");
      },
    });
    await expect(removeAccount("user-1", PHONE, fake)).rejects.toThrow("nope");
  });
});

describe("messageBelongsToPhone", () => {
  it("matches a message id that carries this number, and not another", () => {
    expect(messageBelongsToPhone(messageIdFor(PHONE), PHONE)).toBe(true);
    expect(messageBelongsToPhone(messageIdFor("254706931455"), PHONE)).toBe(false);
    expect(messageBelongsToPhone(`id-${PHONE}`, PHONE)).toBe(true);
  });
});
