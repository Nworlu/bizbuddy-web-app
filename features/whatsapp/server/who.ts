// Who this WhatsApp chat is with: the shop owner, running their business. Buyers are not chatted with.

import { findShop, getAbout, loadBooks } from "./books";
import { resolveChat, type ChatWith } from "../lib/person";

export async function whoIsChatting(phone: string, profileName: string | null): Promise<ChatWith> {
  const businessId = await findShop(phone);
  if (!businessId) return resolveChat({ owner: null, profileName });

  const books = await loadBooks(businessId);
  const about = await getAbout(phone);
  const stillThere = about && about.businessId === businessId ? books.customers.find((customer) => customer.id === about.customerId) : undefined;
  return resolveChat({
    owner: {
      name: books.business?.ownerName ?? "there",
      shop: books.business?.name ?? "your shop",
      businessId,
      about: stillThere ? { id: stillThere.id, name: stillThere.name } : null,
    },
    profileName,
  });
}
