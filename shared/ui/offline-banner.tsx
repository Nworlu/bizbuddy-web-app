"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/**
 * Shown while the phone has no connection. Records are saved in this browser, so recording still works;
 * what can fail is opening a page that hasn't been loaded yet. Never claim anything was synced.
 */
export function OfflineBanner() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  if (online) return null;
  return (
    <div role="status" className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 md:px-8">
      <p className="mx-auto max-w-5xl">
        <span className="font-semibold">You&apos;re offline.</span> Your records are saved on this phone, and you can keep recording. Pages you haven&apos;t opened yet may not load until you&apos;re back online.
      </p>
    </div>
  );
}
