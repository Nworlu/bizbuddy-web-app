"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Logo } from "@/shared/ui/logo";
import { useBizData } from "@/shared/lib/store";
import { BENEFITS, STEPS } from "../content/landing";
import { FAQ } from "../content/faq";

const STEP_TONES = [
  "flex min-h-64 flex-col justify-between rounded-[1.75rem] bg-white p-6 text-stone-600 shadow-xl shadow-stone-300/50 md:min-h-80 md:rotate-[-2deg] md:p-7 [&_h3]:text-ink",
  "flex min-h-64 flex-col justify-between rounded-[1.75rem] bg-brand-100 p-6 text-brand-800 shadow-xl shadow-brand-900/10 md:min-h-80 md:translate-y-6 md:rotate-[2deg] md:p-7 [&_h3]:text-ink",
  "flex min-h-64 flex-col justify-between rounded-[1.75rem] bg-brand-800 p-6 text-brand-100 shadow-xl shadow-brand-900/20 md:min-h-80 md:rotate-[-1deg] md:p-7 [&_h3]:text-white",
];

const RIBBON = ["Record the sale", "Count what came in", "Write what you spent", "See the day"];
const RIBBON_TWO = ["Works offline", "Learns your shop", "Backed up to your account", "Only you see your books"];

export function LandingScreen() {
  const data = useBizData();
  const hasBusiness = Boolean(data?.business);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuTitleId = useId();

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <div className="min-h-screen bg-[#f6f4f0] text-ink">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow">
        Skip to content
      </a>

      <header className="sticky top-0 z-40 bg-[#f6f4f0]/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-8">
          <Link href="/" aria-current="page" className="rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700">
            <Logo size="sm" />
          </Link>
          <nav aria-label="Page" className="hidden items-center gap-8 md:flex">
            <a href="#how" className="text-sm text-stone-600 hover:text-ink">
              How it works
            </a>
            <a href="#learns" className="text-sm text-stone-600 hover:text-ink">
              Your shop
            </a>
            <a href="#questions" className="text-sm text-stone-600 hover:text-ink">
              Questions
            </a>
          </nav>
          <div className="hidden items-center gap-5 md:flex">
            <Link href="/login" className="text-sm font-medium text-stone-600 hover:text-ink">
              Log in
            </Link>
            <Link href="/welcome" className="text-sm font-semibold text-brand-700 hover:text-brand-800">
              Start your books
            </Link>
          </div>
          <button
            type="button"
            className="relative flex size-10 items-center justify-center rounded-lg md:hidden"
            aria-expanded={menuOpen}
            aria-controls="landing-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="sr-only">{menuOpen ? "Close menu" : "Open menu"}</span>
            <span aria-hidden="true" className={`absolute h-0.5 w-4 bg-ink transition-transform duration-300 ${menuOpen ? "rotate-45" : "-translate-y-1"}`} />
            <span aria-hidden="true" className={`absolute h-0.5 w-4 bg-ink transition-transform duration-300 ${menuOpen ? "-rotate-45" : "translate-y-1"}`} />
          </button>
        </div>
      </header>

      {menuOpen && (
        <div id="landing-menu" role="dialog" aria-modal="true" aria-labelledby={menuTitleId} className="fixed inset-0 z-30 bg-[#f6f4f0] pt-16 md:hidden">
          <p id={menuTitleId} className="sr-only">
            Menu
          </p>
          <nav aria-label="Page" className="flex flex-col px-6 py-8 text-2xl font-semibold">
            <a href="#how" onClick={() => setMenuOpen(false)} className="py-3">
              How it works
            </a>
            <a href="#learns" onClick={() => setMenuOpen(false)} className="py-3">
              Your shop
            </a>
            <a href="#questions" onClick={() => setMenuOpen(false)} className="py-3">
              Questions
            </a>
            <Link href="/welcome" className="mt-4 text-brand-700">
              Start your books
            </Link>
            <Link href="/login" className="py-3 text-stone-600">
              Log in
            </Link>
          </nav>
        </div>
      )}

      <main id="main">
        <section className="px-4 pb-8 pt-16 text-center md:pt-24">
          <h1 className="reveal-load mx-auto max-w-4xl text-balance text-5xl font-bold leading-[0.95] tracking-tight md:text-7xl">
            <span className="text-stone-500">Run the shop</span>
            <br />
            from one book.
          </h1>
          <p className="reveal-load mx-auto mt-6 max-w-xl text-pretty text-base leading-7 text-stone-600 md:text-lg" style={{ animationDelay: "120ms" }}>
            A book for the business. Record what you sold, what came in, and what you spent, whether the sale was in the shop, on Instagram, or on WhatsApp.
          </p>
          <div className="reveal-load mt-8 flex items-center justify-center gap-2" style={{ animationDelay: "200ms" }}>
            <Link href="/welcome" className="rounded-full bg-ink px-6 py-3 text-base font-semibold text-white hover:bg-brand-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700">
              Start your books
            </Link>
            <Link href="/welcome" aria-label="Start your books" className="flex size-12 items-center justify-center rounded-full bg-brand-100 text-brand-800 hover:bg-brand-200">
              <Arrow />
            </Link>
          </div>
        </section>

        {/* Phones: a staggered stack, so every slip can be read. From md up: slips float over each other. */}
        <section aria-label="Example sale" className="relative mx-auto flex max-w-sm flex-col px-6 pb-16 pt-4 md:block md:h-96 md:max-w-3xl md:px-0 md:pb-0 md:pt-0">
          <Slip className="self-start [--tilt:-3deg] md:left-[8%] md:top-8 md:[--tilt:-8deg]" delay="0s" name="David" detail="Sneakers" label="Sale" amount="₦85,000" />
          <Slip className="-mt-3 self-end [--tilt:3deg] md:left-[36%] md:top-20 md:mt-0 md:[--tilt:5deg]" delay="0.8s" name="Paid today" detail="Bank transfer" label="Paid" amount="₦50,000" />
          <Slip className="-mt-3 self-start [--tilt:-2deg] md:right-[8%] md:top-6 md:mt-0" delay="1.4s" name="Delivery" detail="Sent today" label="Spent" amount="₦4,000" emphasis />
        </section>

        <CurvedRibbons top={RIBBON} bottom={RIBBON_TWO} />

        <section className="px-4 py-20 md:py-28">
          <p className="reveal mx-auto max-w-4xl text-balance text-center text-3xl font-bold leading-tight tracking-tight md:text-5xl">
            Sold two sneakers for ₦85,000. ₦50,000 came in. ₦4,000 went on delivery.
          </p>
        </section>

        <section id="how" className="px-4 py-16 md:px-8 md:py-24">
          <div className="mx-auto max-w-5xl">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <p className="flex items-center gap-2 text-sm text-stone-600">
                <Spark />
                How it works
              </p>
              <h2 className="max-w-xl text-balance text-4xl font-bold tracking-tight md:text-right md:text-5xl">
                From the sale to the day <span className="text-stone-500">in one place.</span>
              </h2>
            </div>
            <ol className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5">
              {STEPS.map((step, index) => (
                <li key={step.title} className={STEP_TONES[index]}>
                  <div className="flex items-start justify-between">
                    <p className="text-sm">0{index + 1}</p>
                    <Spark />
                  </div>
                  <div>
                    <h3 className="text-2xl font-semibold">{step.title}</h3>
                    <p className="mt-2 text-base leading-6">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="px-4 py-8 md:px-8 md:py-12">
          <div className="mx-auto max-w-5xl">
            <p className="flex items-center gap-2 text-sm text-stone-600">
              <Spark />
              The money
            </p>
            <h2 className="mt-4 max-w-xl text-balance text-4xl font-bold tracking-tight md:text-6xl">
              <span className="text-stone-500">The money,</span> in one place.
            </h2>
            <ul className="mt-10 border-t border-stone-300">
              {BENEFITS.map((item) => (
                <li key={item.title} className="border-b border-stone-300 py-8 md:py-10">
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="text-3xl font-bold tracking-tight md:text-5xl">{item.title}</h3>
                    <Link
                      href="/welcome"
                      aria-label={`${item.title}. Start your books`}
                      className="mt-1 flex size-12 shrink-0 items-center justify-center rounded-full bg-white text-brand-800 shadow-md shadow-stone-300/60 hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
                    >
                      <Arrow />
                    </Link>
                  </div>
                  <p className="mt-3 max-w-xl text-base leading-7 text-stone-600">{item.body}</p>
                  <ul className="mt-5 flex list-none flex-wrap gap-2">
                    {item.points.map((point) => (
                      <li key={point} className="rounded-full bg-white px-4 py-2 text-sm text-stone-600">
                        {point}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="learns" className="px-4 py-16 md:px-8 md:py-24">
          <div className="mx-auto max-w-5xl">
            <p className="flex items-center gap-2 text-sm text-stone-600">
              <Spark />
              Your shop
            </p>
            <h2 className="mt-4 max-w-xl text-balance text-4xl font-bold tracking-tight md:text-6xl">
              It learns <span className="text-stone-500">how you run it.</span>
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-stone-600">
              Tell BizBuddy the day in your own words. Each note you confirm teaches it this shop: what you sell, who you mean, and how you write “85k”. The next note is easier. Another owner’s shop never sees it.
            </p>
            <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
              <article className="flex min-h-64 flex-col justify-between rounded-[1.75rem] bg-white p-6 text-stone-600 shadow-xl shadow-stone-300/50 md:min-h-72 md:rotate-[-1.5deg] md:p-7">
                <p className="text-sm">The first note</p>
                <div>
                  <p className="text-2xl font-semibold text-ink">“Sold 2 sneakers to David for 85k, he paid 50k.”</p>
                  <p className="mt-3 text-base leading-6">BizBuddy shows the sale and waits. You fix anything it missed, then save. That save is the lesson.</p>
                </div>
              </article>
              <article className="flex min-h-64 flex-col justify-between rounded-[1.75rem] bg-brand-800 p-6 text-brand-100 shadow-xl shadow-brand-900/20 md:min-h-72 md:translate-y-6 md:rotate-[1.5deg] md:p-7">
                <p className="text-sm">After a few days</p>
                <div>
                  <p className="text-2xl font-semibold text-white">“David, sneakers again, transfer.”</p>
                  <p className="mt-3 text-base leading-6 text-brand-100">It already knows this shop sells sneakers, that David buys them, and that you write money as 85k.</p>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section id="questions" className="bg-brand-900 px-4 py-16 text-white md:px-8 md:py-24">
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-10 md:grid-cols-[0.85fr_1.15fr] md:items-start">
            <div className="md:sticky md:top-24">
              <p className="flex items-center gap-2 text-sm text-brand-100">
                <Spark />
                Questions
              </p>
              <h2 className="mt-4 text-balance text-4xl font-bold tracking-tight md:text-5xl">
                Questions, <span className="text-brand-200">before you start.</span>
              </h2>
              <Link href="/welcome" className="mt-8 inline-flex items-center gap-2 text-base font-semibold text-white hover:text-brand-100">
                Start your books
                <Arrow />
              </Link>
            </div>
            <div className="flex flex-col gap-3">
              {FAQ.map((item) => (
                <details key={item.q} className="group rounded-[1.75rem] bg-white px-5 py-4 text-ink">
                  <summary className="cursor-pointer list-none text-lg font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-700 [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center justify-between gap-4">
                      {item.q}
                      <span aria-hidden="true" className="text-2xl font-normal leading-none text-stone-500 transition-transform duration-300 group-open:rotate-45">
                        +
                      </span>
                    </span>
                  </summary>
                  <p className="mt-3 max-w-lg text-base leading-6 text-stone-600">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-ink px-4 py-20 text-white md:py-28">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="text-balance text-4xl font-bold tracking-tight md:text-6xl">Start with today’s sales.</h2>
            <p className="mx-auto mt-4 max-w-md text-base leading-7 text-stone-300">Name the shop, or open Ada’s Fashion and look through a day that is already filled in.</p>
            <div className="mt-8 flex items-center justify-center gap-2">
              <Link href="/welcome" className="rounded-full bg-white px-6 py-3 text-base font-semibold text-ink hover:bg-brand-50">
                Start your books
              </Link>
              {!hasBusiness && (
                <Link href="/welcome?demo=1" className="rounded-full px-4 py-3 text-sm font-semibold text-brand-200 hover:text-white">
                  Sample shop
                </Link>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="flex items-center justify-between px-4 py-8 md:px-8">
        <Logo size="sm" />
        <nav aria-label="Footer" className="flex gap-4 text-sm text-stone-600">
          <Link href="/privacy" className="hover:text-ink">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-ink">
            Terms
          </Link>
        </nav>
      </footer>
    </div>
  );
}

const CURVE = "M 0 180 C 220 130 340 125 520 150 C 700 175 820 120 1000 135";
const CURVE_LOWER = "M 0 248 C 220 198 340 193 520 218 C 700 243 820 188 1000 203";
const COPIES = 6;

function line(items: string[]) {
  return `${items.join("\u00A0·\u00A0")}\u00A0·\u00A0`;
}

function CurvedRibbons({ top, bottom }: { top: string[]; bottom: string[] }) {
  const rawId = useId().replace(/:/g, "");
  const topId = `${rawId}-top`;
  const bottomId = `${rawId}-bottom`;
  const topPath = useRef<SVGPathElement>(null);
  const bottomPath = useRef<SVGPathElement>(null);
  const topMeasure = useRef<SVGTextElement>(null);
  const bottomMeasure = useRef<SVGTextElement>(null);
  const topText = useRef<(SVGTextPathElement | null)[]>([]);
  const bottomText = useRef<(SVGTextPathElement | null)[]>([]);
  const topLine = line(top);
  const bottomLine = line(bottom);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let stopped = false;

    const run = () => {
      if (stopped) return;
      const bands = [
        { path: topPath.current, measure: topMeasure.current, nodes: topText.current, reverse: false },
        { path: bottomPath.current, measure: bottomMeasure.current, nodes: bottomText.current, reverse: true },
      ];
      if (bands.some((band) => !band.path || !band.measure || band.measure.getComputedTextLength() === 0)) {
        frame = requestAnimationFrame(run);
        return;
      }

      const speeds = bands.map((band) => {
        const rendered = band.nodes[0]?.getComputedTextLength() ?? 0;
        const textLen = Math.max(band.measure!.getComputedTextLength(), rendered) * 1.02;
        return { textLen, pxPerMs: (textLen / 18000) * (band.reverse ? -1 : 1) };
      });
      const offsets = [0, 0];

      const apply = () => {
        bands.forEach((band, bandIndex) => {
          const { textLen } = speeds[bandIndex];
          const span = textLen * COPIES;
          band.nodes.forEach((node, index) => {
            if (!node) return;
            const pos = ((offsets[bandIndex] + index * textLen) % span + span) % span - textLen;
            node.setAttribute("startOffset", String(pos));
          });
        });
      };

      apply();
      if (reduce) return;

      let last = performance.now();
      const tick = (now: number) => {
        const dt = now - last;
        last = now;
        offsets[0] += speeds[0].pxPerMs * dt;
        offsets[1] += speeds[1].pxPerMs * dt;
        apply();
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };

    const fonts = document.fonts?.ready.then(run);
    if (!fonts) run();
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
    };
  }, [topLine, bottomLine]);

  return (
    <div className="relative z-20 -mt-10 overflow-x-clip md:-mt-16">
      <svg viewBox="-80 70 1160 230" className="relative left-1/2 block h-auto w-[165%] max-w-none -translate-x-1/2" role="presentation" aria-hidden="true">
        <path ref={topPath} id={topId} d={CURVE} fill="none" stroke="#ffffff" strokeWidth="78" strokeLinecap="round" />
        <path ref={bottomPath} id={bottomId} d={CURVE_LOWER} fill="none" stroke="#166534" strokeWidth="58" strokeLinecap="round" />
        <text ref={topMeasure} opacity="0" fontSize="32" className="font-sans font-bold">
          {topLine}
        </text>
        <text ref={bottomMeasure} opacity="0" fontSize="20" className="font-sans font-semibold">
          {bottomLine}
        </text>
        {Array.from({ length: COPIES }, (_, index) => (
          <text key={`top-${index}`} fill="#1c1917" fontSize="32" className="font-sans font-bold">
            <textPath ref={(node) => { topText.current[index] = node; }} href={`#${topId}`} dominantBaseline="central">
              {topLine}
            </textPath>
          </text>
        ))}
        {Array.from({ length: COPIES }, (_, index) => (
          <text key={`bottom-${index}`} fill="#ffffff" fontSize="20" className="font-sans font-semibold">
            <textPath ref={(node) => { bottomText.current[index] = node; }} href={`#${bottomId}`} dominantBaseline="central">
              {bottomLine}
            </textPath>
          </text>
        ))}
      </svg>
    </div>
  );
}

function Slip({
  className,
  delay,
  name,
  detail,
  label,
  amount,
  emphasis = false,
}: {
  className: string;
  delay: string;
  name: string;
  detail: string;
  label: string;
  amount: string;
  emphasis?: boolean;
}) {
  return (
    <article
      style={{ animationDelay: delay }}
      className={`float-card relative w-56 rounded-3xl p-5 md:absolute shadow-xl shadow-stone-300/50 md:w-60 ${emphasis ? "border border-brand-800 bg-brand-900 text-white" : "border border-white bg-white"} ${className}`}
    >
      <p className={`text-xs font-medium ${emphasis ? "text-brand-200" : "text-stone-500"}`}>{label}</p>
      <p className="mt-3 text-lg font-semibold">{name}</p>
      <p className={`text-sm ${emphasis ? "text-brand-100" : "text-stone-500"}`}>{detail}</p>
      <p className={`mt-4 text-2xl font-bold tabular-nums ${emphasis ? "text-amber-300" : ""}`}>{amount}</p>
    </article>
  );
}

function Spark() {
  return (
    <svg viewBox="0 0 16 16" className="size-4 shrink-0" fill="currentColor" aria-hidden="true">
      <path d="M8 0.6 9.3 6.7 15.4 8 9.3 9.3 8 15.4 6.7 9.3 0.6 8 6.7 6.7 8 0.6Z" />
    </svg>
  );
}

function Arrow() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
