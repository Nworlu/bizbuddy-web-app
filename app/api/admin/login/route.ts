import { adminConfigured, ADMIN_COOKIE, verifyAdminPassword } from "@/features/admin/server/auth";

export async function POST(request: Request) {
  if (!adminConfigured()) return Response.json({ error: "Admin is not configured." }, { status: 503 });
  let password = "";
  try {
    const body = (await request.json()) as { password?: string };
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }
  if (!verifyAdminPassword(password)) return Response.json({ error: "Wrong password." }, { status: 401 });
  const response = Response.json({ ok: true });
  response.headers.append("Set-Cookie", `${ADMIN_COOKIE}=${encodeURIComponent(process.env.ADMIN_SECRET!)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 12}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
  return response;
}
