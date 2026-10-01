"use client";

// The browser side of /api/tell/knowledge: what BizBuddy knows about the business, and teaching it.

import { getSyncMeta } from "@/shared/lib/store";
import { accountsEnabled, supabase } from "@/shared/lib/supabase";
import type { CatalogItem, Learned, Socials } from "./knowledge";

export type Knowledge = { description: string; catalog: CatalogItem[]; socials: Socials };
export class KnowledgeError extends Error {}

async function call<T>(method: string, body?: unknown): Promise<T> {
  if (!accountsEnabled() || getSyncMeta() === null) throw new KnowledgeError("Back up your books with an account first.");
  const session = (await supabase()?.auth.getSession())?.data.session;
  if (!session) throw new KnowledgeError("Log in again first.");
  let response: Response;
  try {
    response = await fetch("/api/tell/knowledge", {
      method,
      headers: { authorization: `Bearer ${session.access_token}`, ...(body ? { "content-type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new KnowledgeError("You're offline. Try again when you're connected.");
  }
  const json = await response.json().catch(() => null);
  if (!response.ok) throw new KnowledgeError(json?.error ?? "Couldn't do that just now. Try again.");
  return json as T;
}

export const getKnowledge = () => call<Knowledge>("GET");
export const updateKnowledge = (change: { socials?: Socials; removeProduct?: string; description?: string }) => call<Knowledge>("PATCH", change);
export const saveLearned = (learned: Learned) => call<Knowledge>("POST", { action: "save", learned });
export const readWebsite = (url: string) => call<{ learned: Learned }>("POST", { action: "read-website", url }).then((r) => r.learned);

/** Shrinks a photo to at most 1600px on the long side as JPEG before sending (phone photos are big). */
async function shrink(file: File): Promise<{ data: string; mime: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL("image/jpeg", 0.85);
  return { data: url.slice(url.indexOf(",") + 1), mime: "image/jpeg" };
}

export async function readImage(file: File): Promise<Learned> {
  const image = await shrink(file).catch(() => {
    throw new KnowledgeError("Couldn't open that picture. Try a JPEG or PNG screenshot.");
  });
  return call<{ learned: Learned }>("POST", { action: "read-image", ...image }).then((r) => r.learned);
}
