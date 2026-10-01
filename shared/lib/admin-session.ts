// Server only: simple shared-secret gate for the BizBuddy operator dashboard at /admin.

import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE = "bizbuddy_admin";

export function adminEnabled(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD?.trim());
}

function token(): string | null {
  const password = process.env.ADMIN_PASSWORD?.trim();
  if (!password) return null;
  return createHmac("sha256", password).update("bizbuddy-admin-v1").digest("hex");
}

export async function adminAuthorized(): Promise<boolean> {
  const expected = token();
  if (!expected) return false;
  const jar = await cookies();
  const got = jar.get(COOKIE)?.value;
  if (!got || got.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(got), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function setAdminSession(): Promise<boolean> {
  const expected = token();
  if (!expected) return false;
  const jar = await cookies();
  jar.set(COOKIE, expected, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return true;
}

export async function clearAdminSession(): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}
