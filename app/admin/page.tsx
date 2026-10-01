import { AdminScreen } from "@/features/admin/screen/admin-screen";
import { fetchAdminOverview } from "@/features/admin/server/overview";
import { adminAuthorized, adminEnabled } from "@/shared/lib/admin-session";

export default async function AdminPage() {
  if (!adminEnabled()) return <AdminScreen mode="disabled" />;
  if (!(await adminAuthorized())) return <AdminScreen mode="login" />;
  const overview = await fetchAdminOverview();
  return <AdminScreen mode="ready" overview={overview} />;
}
