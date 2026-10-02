"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * A modal that asks before something can't be undone. Cancel has focus first, and Escape or a tap
 * outside cancels. When `onConfirm` is omitted it only explains (e.g. why a delete is blocked).
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  onConfirm,
  onCancel,
  cancelLabel = "Cancel",
  error,
  busy = false,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  onConfirm?: () => void;
  onCancel: () => void;
  cancelLabel?: string;
  error?: string | null;
  /** While true, both buttons wait. Cancel works again once this is false. */
  busy?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onClose={() => open && !busy && onCancel()}
      onClick={(e) => e.target === e.currentTarget && !busy && onCancel()}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(26rem,calc(100%-2rem))] overflow-y-auto rounded-2xl bg-white p-0 backdrop:bg-black/40"
    >
      {open && (
        <div className="p-6">
          <h2 id={titleId} className="text-lg font-bold text-ink">{title}</h2>
          <div id={bodyId} className="mt-2 max-h-[40dvh] space-y-2 overflow-y-auto text-sm leading-relaxed text-ink-muted">{children}</div>
          {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
          <div className="mt-6 flex gap-2">
            <button type="button" autoFocus onClick={onCancel} disabled={busy} className="flex-1 rounded-xl bg-stone-100 py-3 text-sm font-medium text-ink hover:bg-stone-200 disabled:opacity-60">
              {onConfirm ? cancelLabel : "OK"}
            </button>
            {onConfirm && confirmLabel && (
              <button type="button" onClick={onConfirm} disabled={busy} className="flex-1 rounded-xl bg-rose-700 py-3 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-60">
                {confirmLabel}
              </button>
            )}
          </div>
        </div>
      )}
    </dialog>
  );
}
