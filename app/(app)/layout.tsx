import type { Metadata } from "next";
import { AppShell } from "@/features/shell/components/app-shell";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AppLayout({ children }: LayoutProps<"/">) {
  return <AppShell>{children}</AppShell>;
}
