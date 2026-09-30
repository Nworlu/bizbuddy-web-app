"use client";

import { useEffect } from "react";

/**
 * Registers public/sw.js so BizBuddy opens with no internet. Production only: in development the
 * service worker would serve stale pages over hot reloads.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Not fatal: the app still works online, and records are saved on the phone either way.
    });
  }, []);
  return null;
}
