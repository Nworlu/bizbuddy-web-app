import Link from "next/link";

export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-8">
      <h1 className="mb-6 text-2xl font-bold">{title}</h1>
      <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center">
        <p className="mb-5 text-sm text-ink-muted">{description}</p>
        <Link href="/dashboard" className="text-sm font-medium text-brand-700 hover:text-brand-800">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
