import type { Metadata } from "next";
import { LoginPage } from "@/features/account/screen/login-screen";

export const metadata: Metadata = { title: "Log in — BizBuddy" };

export default function Page() {
  return <LoginPage />;
}
