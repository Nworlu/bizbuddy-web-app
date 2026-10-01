import { adminConfigured, verifyAdminRequest } from "@/features/admin/server/auth";
import { fetchAdminOverview } from "@/features/admin/server/overview";

export async function GET(request: Request) {
  if (!adminConfigured()) return Response.json({ error: "Admin is not configured." }, { status: 503 });
  if (!verifyAdminRequest(request)) return Response.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const overview = await fetchAdminOverview();
    return Response.json(overview);
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Could not load businesses." }, { status: 500 });
  }
}
