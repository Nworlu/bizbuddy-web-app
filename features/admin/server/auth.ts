import { timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE = "bizbuddy-admin";

function secret(): string | null {
  const value = process.env.ADMIN_SECRET?.trim();
  return value || null;
}

export function adminConfigured(): boolean {
  return secret() !== null;
}

function safeEqual(a: string, b: string): boolean {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  if (aa.length !== bb.length) return false;
  return timingSafeEqual(aa, bb);
}

export function verifyAdminPassword(password: string): boolean {
  const expected = secret();
  if (!expected) return false;
  return safeEqual(password, expected);
}

function cookieValue(request: Request, name: string): string {
  const header = request.headers.get("cookie");
  if (!header) return "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}

export function verifyAdminRequest(request: Request): boolean {
  const expected = secret();
  if (!expected) return false;
  return safeEqual(cookieValue(request, ADMIN_COOKIE), expected);
}

export function adminCookieOptions(maxAgeSeconds = 60 * 60 * 12) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
