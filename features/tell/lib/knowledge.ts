// What BizBuddy learns about a business from what the owner shows it: screenshots or photos of their
// page, catalogue, or price list, their website, and their social handles. Kept in shop memory (only
// after the owner confirms) and told to the AI with each note, so it knows what the shop sells.
// Pure. Reading images and websites is server/learn-business.ts.

import { formatNaira } from "@/shared/lib/format";

export type CatalogItem = { name: string; price: number | null };
export const SOCIAL_PLATFORMS = ["instagram", "tiktok", "facebook", "x", "website"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];
export type Socials = Partial<Record<SocialPlatform, string>>;

/** What one screenshot, photo, or website showed, before the owner confirms it. */
export type Learned = { description: string | null; products: CatalogItem[]; source: string };

export const CATALOG_MAX = 40;
const NAME_MAX = 80;
const DESCRIPTION_MAX = 300;

const clip = (value: string, max: number) => value.replace(/\s+/g, " ").trim().slice(0, max);

/** Tidies what the AI read: names clipped, prices whole naira above zero, no duplicates. */
export function tidyLearned(value: { description?: unknown; products?: unknown }, source: string): Learned {
  const seen = new Set<string>();
  const products: CatalogItem[] = [];
  for (const item of Array.isArray(value.products) ? value.products : []) {
    const row = item as { name?: unknown; price?: unknown };
    const name = typeof row.name === "string" ? clip(row.name, NAME_MAX) : "";
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    const price = typeof row.price === "number" && Number.isSafeInteger(row.price) && row.price > 0 ? row.price : null;
    products.push({ name, price });
    if (products.length >= CATALOG_MAX) break;
  }
  const description = typeof value.description === "string" && value.description.trim() ? clip(value.description, DESCRIPTION_MAX) : null;
  return { description, products, source: clip(source, 120) };
}

export const learnedAnything = (learned: Learned) => learned.description !== null || learned.products.length > 0;

/** What BizBuddy read, for the owner to confirm (WhatsApp text; the website shows the same parts). */
export function describeLearned(learned: Learned): string {
  const lines = [`Here's what I learned from ${learned.source}:`];
  if (learned.description) lines.push("", `_${learned.description}_`);
  if (learned.products.length > 0) {
    lines.push("", "*Products:*", ...learned.products.slice(0, 15).map((p) => `• ${p.name}${p.price ? ` (${formatNaira(p.price)})` : ""}`));
    if (learned.products.length > 15) lines.push(`…and ${learned.products.length - 15} more`);
  }
  lines.push("", "Save this to what I know about your business?");
  return lines.join("\n");
}

/** A link to one of their social pages, as the platform and handle. Null for anything else. */
export function socialFromUrl(text: string): { platform: Exclude<SocialPlatform, "website">; handle: string } | null {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text.trim()) ? text.trim() : `https://${text.trim()}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^(www|m)\./, "");
  const first = decodeURIComponent(url.pathname.split("/").filter(Boolean)[0] ?? "").replace(/^@/, "");
  if (!first || !/^[\w.]{1,60}$/.test(first)) return null;
  if (host === "instagram.com") return { platform: "instagram", handle: first };
  if (host === "tiktok.com") return { platform: "tiktok", handle: first };
  if (host === "facebook.com" || host === "fb.com") return { platform: "facebook", handle: first };
  if (host === "x.com" || host === "twitter.com") return { platform: "x", handle: first };
  return null;
}

/** A message that is only a link (maybe with a word or two), or null. */
export function onlyLink(text: string): string | null {
  const match = /(https?:\/\/[^\s]+|(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+\/?[^\s]*)/i.exec(text.trim());
  if (!match || text.trim().split(/\s+/).length > 4) return null;
  return match[1];
}

export function tidySocials(value: unknown): Socials {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const out: Socials = {};
  for (const platform of SOCIAL_PLATFORMS) {
    const raw = typeof row[platform] === "string" ? clip(row[platform] as string, 120) : "";
    const handle = platform === "website" ? raw : raw.replace(/^@/, "");
    if (handle) out[platform] = handle;
  }
  return out;
}

/** Adds confirmed products (newest first, no duplicates by name) and replaces the description if one was read. */
export function mergeCatalog(catalog: CatalogItem[], description: string, learned: Learned): { catalog: CatalogItem[]; description: string } {
  const names = new Set(learned.products.map((p) => p.name.toLowerCase()));
  return {
    catalog: [...learned.products, ...catalog.filter((p) => !names.has(p.name.toLowerCase()))].slice(0, CATALOG_MAX),
    description: learned.description ?? description,
  };
}

export const SOCIAL_LABELS: Record<SocialPlatform, string> = { instagram: "Instagram", tiktok: "TikTok", facebook: "Facebook", x: "X (Twitter)", website: "website" };

/**
 * For the AI: what the owner showed about the business. Product names only, never prices, so the AI
 * can't use a listed price as an amount the note didn't say (the app never guesses money).
 */
export function knowledgeForPrompt(knowledge: { description: string; catalog: CatalogItem[]; socials: Socials }): string[] {
  const lines: string[] = [];
  if (knowledge.description) lines.push(`From their own page: “${knowledge.description}”.`);
  if (knowledge.catalog.length > 0) lines.push(`Products they list: ${knowledge.catalog.slice(0, 25).map((p) => p.name).join(", ")}.`);
  const online = SOCIAL_PLATFORMS.filter((p) => knowledge.socials[p]).map((p) => (p === "website" ? `website ${knowledge.socials[p]}` : `${SOCIAL_LABELS[p]} @${knowledge.socials[p]}`));
  if (online.length > 0) lines.push(`Online: ${online.join(", ")}.`);
  return lines;
}
