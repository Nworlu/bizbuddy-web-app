// Server only: which check-ins went out (migration 0008), and who can get them. Secret key.

import { db } from "@/features/whatsapp/server/books";
import type { CheckInKind } from "../lib/checkins";

/** Claims today's check-in of this kind for the shop. False when it already went out. */
export async function claimCheckIn(businessId: string, kind: CheckInKind, day: string): Promise<boolean> {
  const { error } = await db().from("check_ins").insert({ business_id: businessId, kind, day });
  if (!error) return true;
  if (error.code === "23505") return false; // Already sent today.
  throw error;
}

/** Gives the claim back when the send failed, so the next run tries again. */
export async function releaseCheckIn(businessId: string, kind: CheckInKind, day: string): Promise<void> {
  await db().from("check_ins").delete().eq("business_id", businessId).eq("kind", kind).eq("day", day);
}

/**
 * Owners who have messaged BizBuddy at least once (whatsapp_chats, migration 0006), with when they last
 * did. Only they get check-ins: writing to BizBuddy is the clearest sign they want to hear from it.
 */
export async function chattingOwners(): Promise<{ phone: string; lastInbound: Date }[]> {
  const { data, error } = await db().from("whatsapp_chats").select("phone, last_inbound_at").limit(1000);
  if (error) throw error;
  return (data ?? []).map((row) => ({ phone: row.phone as string, lastInbound: new Date(row.last_inbound_at as string) }));
}
