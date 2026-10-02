import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/shared/ui/logo";

export const metadata: Metadata = { title: "Page not found", robots: { index: false, follow: false } };

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center">
      <Logo size="lg" />
      <h1 className="mt-8 text-3xl font-bold">This page is not in the book</h1>
      <p className="mt-3 max-w-sm text-pretty text-base leading-6 text-ink-muted">The link may be old, or the page has not been built yet.</p>
      <Link href="/" className="mt-8 inline-flex rounded-full bg-brand-700 px-3 py-2 text-base font-semibold text-white hover:bg-brand-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700">
        Back to BizBuddy
      </Link>
    </main>
  );
}
