// Removes one account and everything saved with it.
//
// The phone comes from that account's login, never from the request.
// Shop rows are deleted by the shop id, then the auth user (which also cascades anything left).
// Two tables are keyed only by phone. WhatsApp's "already seen" ids have no phone column; the
// id itself carries the sender's number, so those that belong to this login are deleted too.

/** Rows that belong to the shop. Each has business_id and cascades from businesses, but they are deleted explicitly so a missing cascade cannot leave them. */
export const SHOP_TABLES = ["customers", "sales", "payments", "expenses", "shop_memory", "whatsapp_pending", "whatsapp_focus", "reminders", "check_ins"] as const;

/** Rows keyed only by the owner's phone, with no shop id. */
export const PHONE_ONLY_TABLES = ["whatsapp_chats", "whatsapp_thread"] as const;

export type AccountAdmin = {
  /** The shop this login owns, or null if they never finished setup. */
  businessId(userId: string): Promise<string | null>;
  /** "missing" when that table has not been created yet. Anything else should throw. */
  deleteShopRows(table: string, businessId: string): Promise<"ok" | "missing">;
  deleteShop(businessId: string): Promise<void>;
  deletePhoneRows(table: string, phone: string): Promise<"ok" | "missing">;
  /** Every stored WhatsApp message id. Empty when that table is not there yet. */
  seenMessageIds(): Promise<string[]>;
  deleteSeenMessages(ids: string[]): Promise<void>;
  deleteUser(userId: string): Promise<void>;
};

/** True when this WhatsApp message id was sent from `phone` (E.164 digits, no plus). */
export function messageBelongsToPhone(id: string, phone: string): boolean {
  if (!phone || phone.length < 8) return false;
  if (id.includes(phone)) return true;
  const payload = id.startsWith("wamid.") ? id.slice("wamid.".length) : id;
  const padded = payload.replace(/-/g, "+").replace(/_/g, "/");
  const text = decodeBase64(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  return text.includes(phone);
}

function decodeBase64(value: string): string {
  try {
    const bytes = typeof Buffer !== "undefined" ? Buffer.from(value, "base64") : Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return "";
  }
}

export async function removeAccount(userId: string, phone: string | null, admin: AccountAdmin): Promise<void> {
  const businessId = await admin.businessId(userId);
  if (businessId) {
    for (const table of SHOP_TABLES) await admin.deleteShopRows(table, businessId);
    await admin.deleteShop(businessId);
  }
  if (phone) {
    for (const table of PHONE_ONLY_TABLES) await admin.deletePhoneRows(table, phone);
    const mine = (await admin.seenMessageIds()).filter((id) => messageBelongsToPhone(id, phone));
    if (mine.length > 0) await admin.deleteSeenMessages(mine);
  }
  await admin.deleteUser(userId);
}
