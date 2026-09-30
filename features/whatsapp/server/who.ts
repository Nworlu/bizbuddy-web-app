// Who this WhatsApp chat is with: the shop owner, or one customer whose number is on the books.

import { findCustomersByPhone, findShop, getAbout, loadBooks } from "./books";
import { resolveChat, type ChatWith } from "../lib/person";

export async function whoIsChatting(phone: string, profileName: string | null): Promise<ChatWith> {
  const businessId = await findShop(phone);
  if (businessId) {
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
      matches: [],
      profileName,
    });
  }

  const matches = await findCustomersByPhone(phone);
  return resolveChat({
    owner: null,
    matches: matches.map((match) => ({ id: match.customerId, name: match.name, phone, businessId: match.businessId, shop: match.shop })),
    profileName,
  });
}
