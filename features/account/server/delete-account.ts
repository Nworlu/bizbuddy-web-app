// Removes one account. The phone comes from that account's login, never from the request.
//
// The shop, its books, memory, reminders, and drafts hang off the auth user or the business and
// disappear with it (on delete cascade). Two tables are keyed only by phone, so they are cleared first.

export const PHONE_ONLY_TABLES = ["whatsapp_chats", "whatsapp_thread"] as const;

export type AccountAdmin = {
  /** "missing" when that table has not been created yet. Anything else should throw. */
  deletePhoneRows(table: string, phone: string): Promise<"ok" | "missing">;
  deleteUser(userId: string): Promise<void>;
};

export async function removeAccount(userId: string, phone: string | null, admin: AccountAdmin): Promise<void> {
  if (phone) {
    for (const table of PHONE_ONLY_TABLES) await admin.deletePhoneRows(table, phone);
  }
  await admin.deleteUser(userId);
}
