import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BizBuddy",
  description: "Track sales, expenses and customer debts for your business.",
};

export const viewport: Viewport = {
  themeColor: "#15803d",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-NG" className={`${outfit.variable} h-full`}>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
