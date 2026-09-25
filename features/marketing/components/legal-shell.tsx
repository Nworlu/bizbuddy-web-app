import Link from "next/link";
import { Logo } from "@/shared/ui/logo";

export function LegalShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-12 md:px-8">
      <Link href="/" className="inline-flex rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700">
        <Logo size="sm" />
      </Link>
      <h1 className="mt-8 text-3xl font-bold">{title}</h1>
      <div className="mt-6 space-y-4 text-pretty text-base leading-6 text-ink-muted">{children}</div>
      <p className="mt-10">
        <Link href="/" className="text-sm font-semibold text-brand-700 hover:text-brand-800">
          Back to BizBuddy
        </Link>
      </p>
    </main>
  );
}
