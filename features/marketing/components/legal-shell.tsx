import Link from "next/link";
import { Logo } from "@/shared/ui/logo";

export function LegalShell({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-12 md:px-8">
      <Link href="/" className="inline-flex rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700">
        <Logo size="sm" />
      </Link>
      <h1 className="mt-8 text-3xl font-bold text-ink">{title}</h1>
      <p className="mt-2 text-sm text-ink-muted">Last updated {updated}</p>
      <div className="mt-8 space-y-8 text-pretty text-base leading-7 text-ink-muted [&_a]:font-semibold [&_a]:text-brand-700 [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-brand-800 [&_a]:focus-visible:outline [&_a]:focus-visible:outline-2 [&_a]:focus-visible:outline-offset-2 [&_a]:focus-visible:outline-brand-700 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-ink [&_section]:space-y-3">
        {children}
      </div>
      <nav aria-label="Legal" className="mt-10 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        <Link href="/privacy" className="font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700">
          Privacy policy
        </Link>
        <Link href="/terms" className="font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700">
          Terms and conditions
        </Link>
        <Link href="/" className="font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700">
          Back to BizBuddy
        </Link>
      </nav>
    </main>
  );
}
