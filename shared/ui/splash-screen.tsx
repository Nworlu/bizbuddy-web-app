import Image from "next/image";

/** Shown over the landing page until the intro finishes. */
export function SplashScreen({ label }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-[#fafaf8]">
      <span className="sr-only">{label || "BizBuddy"}</span>
      <div className="splash-glow" aria-hidden="true" />

      <div className="relative size-52" aria-hidden="true">
        <svg className="splash-ring splash-ring-a absolute inset-0 size-full" viewBox="0 0 208 208">
          <circle cx="104" cy="104" r="96" fill="none" stroke="#bbf7d0" strokeWidth="1.5" strokeDasharray="3 9" />
          <circle cx="104" cy="8" r="4" fill="#15803d" />
        </svg>
        <svg className="splash-ring splash-ring-b absolute inset-4 size-[calc(100%-2rem)]" viewBox="0 0 176 176">
          <circle cx="88" cy="88" r="80" fill="none" stroke="#f6c445" strokeWidth="1.25" strokeDasharray="1.5 11" />
          <circle cx="88" cy="8" r="3.2" fill="#f6c445" />
        </svg>
        <div className="splash-orbit">
          <span className="absolute top-2 left-1/2 size-2.5 -translate-x-1/2 rounded-full bg-brand-700" />
        </div>
        <div className="splash-orbit splash-orbit-b">
          <span className="absolute right-3 bottom-6 size-2 rounded-full bg-amber-400" />
        </div>

        <div className="splash-mark absolute inset-0 m-auto size-28 overflow-hidden rounded-[1.75rem] shadow-lg shadow-brand-900/15">
          <Image src="/logo.png" alt="" width={112} height={112} priority className="size-full object-cover" />
          <span className="splash-shine" />
        </div>
      </div>

      <p className="relative mt-8 text-2xl font-extrabold tracking-tight text-ink" aria-hidden="true">
        {"BizBuddy".split("").map((letter, index) => (
          <span key={`${letter}-${index}`} className="splash-letter" style={{ animationDelay: `${0.55 + index * 0.05}s` }}>
            {letter}
          </span>
        ))}
      </p>
      {label ? <p className="splash-caption relative mt-2 text-sm text-ink-muted">{label}</p> : null}
      <div className="relative mt-6 h-1 w-36 overflow-hidden rounded-full bg-brand-100" aria-hidden="true">
        <div className="splash-fill h-full w-1/3 rounded-full bg-brand-700" />
      </div>
    </div>
  );
}
