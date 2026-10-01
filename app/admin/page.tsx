import type { Metadata } from "next";
import { AdminScreen } from "@/features/admin/screen/admin-screen";

export const metadata: Metadata = {
  title: "Admin — BizBuddy",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminScreen />;
}
