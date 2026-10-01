import { adminEnabled, setAdminSession } from "@/shared/lib/admin-session";

export async function POST(request: Request) {
  if (!adminEnabled()) return Response.json({ ok: false, reason: "disabled" }, { status: 503 });

  const body = (await request.json().catch(() => null)) as { password?: string } | null;
  const password = body?.password ?? "";
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return Response.json({ ok: false }, { status: 401 });
  }

  const ok = await setAdminSession();
  return ok ? Response.json({ ok: true }) : Response.json({ ok: false }, { status: 503 });
}
