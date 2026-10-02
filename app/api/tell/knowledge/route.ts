// What BizBuddy knows about the signed-in owner's business (shop memory), and teaching it more.
// GET: description, products, socials. PATCH { socials?, removeProduct?, description? }: edit them.
// POST { action: "read-image", data (base64), mime } or { action: "read-website", url }: read with the
// AI and return what was found; nothing is saved. POST { action: "save", learned }: save it.

import { createClient } from "@supabase/supabase-js";
import { mergeCatalog, tidyLearned, tidySocials, type Learned } from "@/features/tell/lib/knowledge";
import { IMAGE_MAX_BYTES, LearnError, learnFromImage, learnFromWebsite } from "@/features/tell/server/learn-business";
import { findShop, getMemory, saveMemory } from "@/features/whatsapp/server/books";
import { spendTrial, trialClosedMessage, trialOpen } from "@/features/tell/lib/memory";
import { phoneFromLoginEmail } from "@/shared/lib/phone";

export const maxDuration = 60;

const LIMIT = 20; // reads per user
const WINDOW_MS = 10 * 60_000;
const recent = new Map<string, number[]>();

function withinLimit(key: string): boolean {
  const now = Date.now();
  const times = (recent.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (times.length >= LIMIT) return false;
  recent.set(key, [...times, now]);
  return true;
}

async function shopFor(request: Request): Promise<string | null> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !key) return null;
  const { data, error } = await createClient(url, key, { auth: { persistSession: false } }).auth.getUser(token);
  const phone = !error && data.user?.email ? phoneFromLoginEmail(data.user.email) : null;
  return phone ? findShop(phone) : null;
}

const reply = (status: number, error: string) => Response.json({ error }, { status });

async function json(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const value = await request.json();
    return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function view(memory: Awaited<ReturnType<typeof getMemory>>) {
  return { description: memory.description, catalog: memory.catalog, socials: memory.socials };
}

export async function GET(request: Request) {
  const businessId = await shopFor(request);
  if (!businessId) return reply(401, "Log in first.");
  return Response.json(view(await getMemory(businessId)));
}

export async function PATCH(request: Request) {
  const businessId = await shopFor(request);
  if (!businessId) return reply(401, "Log in first.");
  const input = await json(request);
  if (!input) return reply(400, "Bad request.");
  const memory = await getMemory(businessId);
  const next = { ...memory };
  if (input.socials !== undefined) next.socials = tidySocials(input.socials);
  if (typeof input.removeProduct === "string") next.catalog = memory.catalog.filter((p) => p.name !== input.removeProduct);
  if (typeof input.description === "string") next.description = input.description.replace(/\s+/g, " ").trim().slice(0, 300);
  await saveMemory(businessId, next);
  return Response.json(view(next));
}

export async function POST(request: Request) {
  const businessId = await shopFor(request);
  if (!businessId) return reply(401, "Log in first.");
  const input = await json(request);
  if (!input) return reply(400, "Bad request.");

  if (input.action === "save") {
    const raw = input.learned as Partial<Learned> | undefined;
    const learned = tidyLearned({ description: raw?.description, products: raw?.products }, typeof raw?.source === "string" ? raw.source : "");
    const memory = await getMemory(businessId);
    const next = { ...memory, ...mergeCatalog(memory.catalog, memory.description, learned) };
    await saveMemory(businessId, next);
    return Response.json(view(next));
  }

  if (!withinLimit(businessId)) return reply(429, "That's a lot in a short time. Wait a few minutes, then try again.");
  const memory = await getMemory(businessId);
  if (!trialOpen(memory)) return reply(403, trialClosedMessage());
  try {
    if (input.action === "read-website" && typeof input.url === "string") {
      const learned = await learnFromWebsite(input.url.slice(0, 500));
      await saveMemory(businessId, spendTrial(memory));
      return Response.json({ learned });
    }
    if (input.action === "read-image" && typeof input.data === "string" && typeof input.mime === "string") {
      if (input.data.length > Math.ceil((IMAGE_MAX_BYTES * 4) / 3) + 8) return reply(400, "That picture is too big. Use one under 5 MB.");
      const learned = await learnFromImage({ data: Buffer.from(input.data, "base64"), mime: input.mime });
      await saveMemory(businessId, spendTrial(memory));
      return Response.json({ learned });
    }
  } catch (error) {
    if (error instanceof LearnError) return reply(422, error.message);
    console.error("Learn business: failed", error instanceof Error ? error.message : error);
    return reply(502, "BizBuddy couldn't read that just now. Try again.");
  }
  return reply(400, "Bad request.");
}
