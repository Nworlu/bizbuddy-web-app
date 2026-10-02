import type { Metadata } from "next";
import { AdminScreen } from "@/features/admin/screen/admin-screen";
import { fetchAdminOverview } from "@/features/admin/server/overview";
import { adminAuthorized, adminEnabled } from "@/shared/lib/admin-session";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default async function AdminPage() {
  if (!adminEnabled()) return <AdminScreen mode="disabled" />;
  if (!(await adminAuthorized())) return <AdminScreen mode="login" />;
  const overview = await fetchAdminOverview();
  return <AdminScreen mode="ready" overview={overview} />;
}
