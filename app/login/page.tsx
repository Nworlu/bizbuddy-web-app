import type { Metadata } from "next";
import { LoginPage } from "@/features/account/screen/login-screen";

export const metadata: Metadata = { title: "Log in", robots: { index: false, follow: false } };

export default function Page() {
  return <LoginPage />;
}
