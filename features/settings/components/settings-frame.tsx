"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRightIcon } from "@/shared/ui/icons";

export function SettingsFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-6 md:px-8 md:py-8">
      <Link href="/settings" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-800">
        <ChevronRightIcon className="size-3.5 rotate-180" />
        Settings
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-ink">{title}</h1>
      <div className="mt-5">{children}</div>
    </div>
  );
}
