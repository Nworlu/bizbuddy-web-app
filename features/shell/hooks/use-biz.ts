"use client";

import { createContext, useContext } from "react";
import type { BizData, Business } from "@/shared/lib/types";

export const BizContext = createContext<{ data: BizData; business: Business } | null>(null);

/** Business data for pages inside the app shell. The shell only renders them once a business exists. */
export function useBiz() {
  const ctx = useContext(BizContext);
  if (!ctx) throw new Error("useBiz must be used inside AppShell");
  return ctx;
}
