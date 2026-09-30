// Who this WhatsApp chat is with: the shop owner, running their business. Buyers are not chatted with.
// Returns the books it had to load anyway, so the conversation doesn't load them a second time.

import type { BizData } from "@/shared/lib/types";
import { findShop, getAbout, loadBooks } from "./books";
import { resolveChat, type ChatWith } from "../lib/person";

export async function whoIsChatting(phone: string, profileName: string | null): Promise<{ chat: ChatWith; books: BizData | null }> {
  const businessId = await findShop(phone);
  if (!businessId) return { chat: resolveChat({ owner: null, profileName }), books: null };

  // Independent reads: run them together.
  const [books, about] = await Promise.all([loadBooks(businessId), getAbout(phone)]);
  const stillThere = about && about.businessId === businessId ? books.customers.find((customer) => customer.id === about.customerId) : undefined;
  const chat = resolveChat({
    owner: {
      name: books.business?.ownerName ?? "there",
      shop: books.business?.name ?? "your shop",
      businessId,
      about: stillThere ? { id: stillThere.id, name: stillThere.name } : null,
    },
    profileName,
  });
  return { chat, books };
}
