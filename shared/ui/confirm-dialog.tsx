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
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  onConfirm?: () => void;
  onCancel: () => void;
  cancelLabel?: string;
  error?: string | null;
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
      onClose={() => open && onCancel()}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
      className="m-auto w-[min(26rem,calc(100%-2rem))] rounded-2xl bg-white p-0 backdrop:bg-black/40"
    >
      {open && (
        <div className="p-6">
          <h2 id={titleId} className="text-lg font-bold text-ink">{title}</h2>
          <div id={bodyId} className="mt-2 space-y-2 text-sm leading-relaxed text-ink-muted">{children}</div>
          {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
          <div className="mt-6 flex gap-2">
            <button type="button" autoFocus onClick={onCancel} className="flex-1 rounded-xl bg-stone-100 py-3 text-sm font-medium text-ink hover:bg-stone-200">
              {onConfirm ? cancelLabel : "OK"}
            </button>
            {onConfirm && confirmLabel && (
              <button type="button" onClick={onConfirm} className="flex-1 rounded-xl bg-rose-700 py-3 text-sm font-semibold text-white hover:bg-rose-800">
                {confirmLabel}
              </button>
            )}
          </div>
        </div>
      )}
    </dialog>
  );
}
