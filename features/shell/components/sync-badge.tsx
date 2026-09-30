"use client";

import Link from "next/link";
import { useSyncStatus, type SyncStatus } from "@/shared/lib/sync-runner";
import { accountsEnabled } from "@/shared/lib/supabase";

/** Where the books stand, in a few words. Never says "backed up" until the server has confirmed it (UX spec §28). */
export function syncLabel({ phase, pending }: SyncStatus): { text: string; tone: "ok" | "wait" | "warn" } {
  const waiting = pending === 1 ? "1 change waiting" : `${pending} changes waiting`;
  switch (phase) {
    case "phone-only":
      return { text: "On this phone only", tone: "warn" };
    case "saved":
      return { text: "Backed up", tone: "ok" };
    case "syncing":
      return { text: "Backing up…", tone: "wait" };
    case "offline":
      return { text: pending > 0 ? `Offline · ${waiting}` : "Offline · saved on this phone", tone: "wait" };
    case "needs-login":
      return { text: "Log in to keep backing up", tone: "warn" };
    case "error":
      return { text: pending > 0 ? `Couldn't back up · ${waiting}` : "Couldn't back up · retrying", tone: "warn" };
  }
}

const DOT = { ok: "bg-brand-600", wait: "bg-amber-500", warn: "bg-rose-600" };

export function SyncBadge({ className = "" }: { className?: string }) {
  const status = useSyncStatus();
  if (!accountsEnabled()) return null;
  const { text, tone } = syncLabel(status);
  return (
    <Link href={status.phase === "needs-login" ? "/login" : "/settings"} className={`inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink ${className}`}>
      <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${DOT[tone]}`} />
      <span role="status">{text}</span>
    </Link>
  );
}
