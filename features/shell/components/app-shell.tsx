"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useBizData } from "@/shared/lib/store";
import { AskIcon, CloseIcon, CustomersIcon, ExpenseIcon, HomeIcon, PlusIcon, SalesIcon, SettingsIcon } from "@/shared/ui/icons";
import { Logo } from "@/shared/ui/logo";
import { OfflineBanner } from "@/shared/ui/offline-banner";
import { BizContext } from "../hooks/use-biz";

type NavItem = { href: string; label: string; icon: ReactNode };

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: <HomeIcon /> },
  { href: "/sales", label: "Sales", icon: <SalesIcon /> },
  { href: "/expenses", label: "Expenses", icon: <ExpenseIcon /> },
  { href: "/customers", label: "Customers", icon: <CustomersIcon /> },
  { href: "/ask", label: "Ask BizBuddy", icon: <AskIcon /> },
  { href: "/settings", label: "Settings", icon: <SettingsIcon /> },
];

const QUICK_ACTIONS = [
  { href: "/sales/new", label: "New Sale", hint: "Record something you sold", icon: <SalesIcon /> },
  { href: "/expenses/new", label: "Expense", hint: "Record money you spent", icon: <ExpenseIcon /> },
  { href: "/customers/new", label: "Customer", hint: "Add a new customer", icon: <CustomersIcon /> },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}

export function AppShell({ children }: { children: ReactNode }) {
  const data = useBizData();
  const router = useRouter();
  const business = data?.business;

  useEffect(() => {
    if (data && !data.business) router.replace("/welcome");
  }, [data, router]);

  if (!data || !business) return <ShellSkeleton />;

  return (
    <BizContext.Provider value={{ data, business }}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow">
        Skip to content
      </a>
      <Sidebar businessName={business.name} />
      <MobileHeader businessName={business.name} />
      <main id="main" className="pb-28 md:pb-10 md:pl-60">
        <OfflineBanner />
        {children}
      </main>
      <ToastHost />
      <BottomNav />
    </BizContext.Provider>
  );
}

function ToastHost() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let timer = 0;
    const onToast = (event: Event) => {
      setMessage((event as CustomEvent<string>).detail);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setMessage(null), 4500);
    };
    window.addEventListener("bizbuddy:toast", onToast);
    return () => {
      window.removeEventListener("bizbuddy:toast", onToast);
      window.clearTimeout(timer);
    };
  }, []);

  if (!message) return null;

  return (
    <p role="status" className="fixed bottom-24 left-1/2 z-50 w-[min(24rem,calc(100%-2rem))] -translate-x-1/2 rounded-xl bg-ink px-4 py-3 text-sm font-medium text-white shadow-lg md:bottom-8">
      {message}
    </p>
  );
}

function Sidebar({ businessName }: { businessName: string }) {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-stone-200 bg-white md:flex">
      <div className="border-b border-stone-100 px-6 py-5">
        <Logo />
        <p className="mt-1 truncate text-xs text-ink-muted">{businessName}</p>
      </div>
      <nav aria-label="Main" className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                active ? "bg-brand-50 text-brand-700" : "text-ink-muted hover:bg-stone-50 hover:text-ink"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-2 px-4 pb-6">
        <Link href="/sales/new" className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-800">
          <PlusIcon className="size-5" />
          New Sale
        </Link>
        <Link href="/expenses/new" className="flex w-full items-center justify-center gap-2 rounded-xl bg-stone-100 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-stone-200">
          Record Expense
        </Link>
      </div>
    </aside>
  );
}

function MobileHeader({ businessName }: { businessName: string }) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-stone-200 bg-white/90 px-4 py-3 backdrop-blur md:hidden">
      <div className="min-w-0">
        <Logo size="sm" />
        <span className="sr-only">, {businessName}</span>
      </div>
      <Link href="/settings" aria-label="Settings" className="-mr-2 rounded-lg p-2 text-ink-muted hover:bg-stone-100 hover:text-ink">
        <SettingsIcon />
      </Link>
    </header>
  );
}

function BottomNav() {
  const pathname = usePathname();
  const sheet = useRef<HTMLDialogElement>(null);

  const tab = (item: NavItem, label = item.label) => {
    const active = isActive(pathname, item.href);
    return (
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium ${active ? "text-brand-700" : "text-ink-muted"}`}
      >
        {item.icon}
        {label}
      </Link>
    );
  };

  return (
    <>
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {tab(NAV[0], "Home")}
        {tab(NAV[1])}
        <div className="flex flex-1 justify-center">
          <button
            type="button"
            aria-label="Quick actions"
            aria-haspopup="dialog"
            onClick={() => sheet.current?.showModal()}
            className="flex size-13 -translate-y-3 items-center justify-center rounded-full bg-brand-700 text-white shadow-lg shadow-brand-700/30 transition-transform active:scale-95"
          >
            <PlusIcon />
          </button>
        </div>
        {tab(NAV[3])}
        {tab(NAV[4], "Ask")}
      </nav>

      <dialog
        ref={sheet}
        aria-labelledby="quick-actions-title"
        onClick={(e) => e.target === e.currentTarget && sheet.current?.close()}
        className="fixed inset-x-0 bottom-0 top-auto m-0 w-full max-w-none rounded-t-3xl bg-white p-0 backdrop:bg-black/40 md:hidden"
      >
        <div className="px-5 pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="quick-actions-title" className="text-lg font-semibold">
              What happened?
            </h2>
            <button type="button" aria-label="Close" onClick={() => sheet.current?.close()} className="-mr-2 rounded-lg p-2 text-ink-muted hover:bg-stone-100">
              <CloseIcon />
            </button>
          </div>
          <ul className="space-y-2">
            {QUICK_ACTIONS.map((a) => (
              <li key={a.href}>
                <Link href={a.href} onClick={() => sheet.current?.close()} className="flex items-center gap-4 rounded-2xl border border-stone-200 p-4 hover:bg-stone-50">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">{a.icon}</span>
                  <span>
                    <span className="block font-semibold">+ {a.label}</span>
                    <span className="block text-sm text-ink-muted">{a.hint}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </dialog>
    </>
  );
}

function ShellSkeleton() {
  return (
    <div role="status" aria-live="polite" className="md:pl-60">
      <span className="sr-only">Loading your business…</span>
      <div className="fixed inset-y-0 left-0 hidden w-60 border-r border-stone-200 bg-white md:block" />
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 md:px-8">
        <div className="skeleton h-8 w-56" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-24 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="skeleton h-56 rounded-2xl" />
          <div className="skeleton h-56 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
