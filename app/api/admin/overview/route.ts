import { fetchAdminOverview } from "@/features/admin/server/overview";
import { adminAuthorized, adminEnabled } from "@/shared/lib/admin-session";

export async function GET() {
  if (!adminEnabled()) return Response.json({ reason: "disabled" }, { status: 503 });
  if (!(await adminAuthorized())) return Response.json({ reason: "unauthorized" }, { status: 401 });
  const overview = await fetchAdminOverview();
  return Response.json(overview);
}
