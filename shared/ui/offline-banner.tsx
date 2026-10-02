"use client";

import { useSyncExternalStore } from "react";
import { runningAsApp } from "./install-guide";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/**
 * Shown while the phone has no connection. Records are saved in this browser and the service worker
 * (public/sw.js) serves the pages, so the app keeps working. Never claim anything was synced: there is no server yet.
 */
export function OfflineBanner() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  if (online) return null;
  return (
    <div role="status" className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 md:px-8">
      <p className="mx-auto max-w-5xl">
        <span className="font-semibold">You&apos;re offline.</span>{" "}
        {runningAsApp()
          ? "This app still works. Everything you record is saved on this phone."
          : "The website needs internet to open. Add BizBuddy to your home screen, and that app opens with no internet. What you already recorded stays on this phone."}
      </p>
    </div>
  );
}
