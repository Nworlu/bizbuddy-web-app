import { clearAdminSession } from "@/shared/lib/admin-session";

export async function POST() {
  await clearAdminSession();
  return Response.json({ ok: true });
}
