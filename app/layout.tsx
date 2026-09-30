import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import { ServiceWorker } from "@/shared/ui/service-worker";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BizBuddy",
  description: "Track sales, expenses and customer debts for your business.",
  applicationName: "BizBuddy",
  appleWebApp: { capable: true, title: "BizBuddy", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#15803d",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-NG" className={`${outfit.variable} h-full`}>
      <body className="min-h-full font-sans">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
