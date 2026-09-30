"use client";

// Runs syncOnce() in the background while the app is open, and reports how it's going.
//
// When: shortly after every change (debounced), when the connection comes back, when the app is
// brought back to the front, and every minute. After a failure it retries with a growing delay.
// Nothing here can lose a record: the outbox only shrinks once the server has accepted a change.

import { useSyncExternalStore } from "react";
import { sessionUserId } from "./account";
import { getSyncMeta, subscribeToStore, syncIO } from "./store";
import { accountsEnabled, remoteApi } from "./supabase";
import { syncOnce } from "./sync";

export type SyncPhase =
  /** The books are on this phone only: no account linked (or accounts aren't set up). */
  | "phone-only"
  /** Linked, and everything on the phone has reached the account. */
  | "saved"
  | "syncing"
  /** No connection. Changes wait on the phone. */
  | "offline"
  /** The account's session is gone (logged out elsewhere, or expired). Log in again to keep backing up. */
  | "needs-login"
  /** The server refused or failed. It will try again. */
  | "error";

export interface SyncStatus {
  phase: SyncPhase;
  /** Changes on this phone that haven't reached the account yet. */
  pending: number;
  lastSyncedAt: string | null;
}

const DEBOUNCE_MS = 1500;
const EVERY_MS = 60_000;
const RETRY_MS = [5_000, 15_000, 30_000, 60_000];

let status: SyncStatus = { phase: "phone-only", pending: 0, lastSyncedAt: null };
const listeners = new Set<() => void>();
let running = false;
let again = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let failures = 0;

function setStatus(next: Partial<SyncStatus>) {
  const pending = Object.keys(getSyncMeta()?.outbox ?? {}).length;
  const merged = { ...status, pending, ...next };
  if (merged.phase === status.phase && merged.pending === status.pending && merged.lastSyncedAt === status.lastSyncedAt) return;
  status = merged;
  listeners.forEach((l) => l());
}

function schedule(delay: number) {
  clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), delay);
}

/** Syncs now. If a sync is already running, runs once more after it. */
export async function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return;
  }
  const meta = getSyncMeta();
  if (!meta || !accountsEnabled()) return setStatus({ phase: "phone-only" });
  if (typeof navigator !== "undefined" && !navigator.onLine) return setStatus({ phase: "offline" });

  running = true;
  setStatus({ phase: "syncing" });
  try {
    const userId = await sessionUserId();
    if (userId !== meta.userId) {
      setStatus({ phase: "needs-login" });
      return;
    }
    await syncOnce(remoteApi, syncIO);
    failures = 0;
    setStatus({ phase: "saved", lastSyncedAt: new Date().toISOString() });
    schedule(EVERY_MS);
  } catch {
    setStatus({ phase: typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "error" });
    schedule(RETRY_MS[Math.min(failures++, RETRY_MS.length - 1)]);
  } finally {
    running = false;
    if (again) {
      again = false;
      schedule(0);
    }
  }
}

/** Starts background syncing. Returns a function that stops it. Called by the app shell. */
export function startSyncing(): () => void {
  let lastSeq = getSyncMeta()?.seq ?? -1;
  const unsubscribe = subscribeToStore(() => {
    const meta = getSyncMeta();
    // A new change was queued: send it soon. (Pulled changes don't bump seq, so they don't trigger this.)
    if (meta && meta.seq !== lastSeq) {
      lastSeq = meta.seq;
      schedule(DEBOUNCE_MS);
    }
    setStatus({ phase: meta ? (status.phase === "phone-only" ? "syncing" : status.phase) : "phone-only" });
  });
  const onOnline = () => schedule(0);
  const onOffline = () => setStatus({ phase: getSyncMeta() ? "offline" : "phone-only" });
  const onVisible = () => document.visibilityState === "visible" && schedule(0);
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  document.addEventListener("visibilitychange", onVisible);
  schedule(0);
  return () => {
    unsubscribe();
    clearTimeout(timer);
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
    document.removeEventListener("visibilitychange", onVisible);
  };
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const SERVER_STATUS: SyncStatus = { phase: "phone-only", pending: 0, lastSyncedAt: null };

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribe, () => status, () => SERVER_STATUS);
}
