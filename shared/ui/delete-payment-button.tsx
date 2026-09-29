"use client";

import { useState } from "react";
import { paymentGroup } from "@/shared/lib/finance";
import { formatDate, formatNaira } from "@/shared/lib/format";
import { deletePayment } from "@/shared/lib/store";
import { showToast } from "@/shared/lib/toast";
import type { BizData } from "@/shared/lib/types";
import { ConfirmDialog } from "./confirm-dialog";

/** Deletes a payment after asking. A split payment is deleted from every sale it paid, and the dialog says so. */
export function DeletePaymentButton({ groupId, data }: { groupId: string; data: BizData }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parts = paymentGroup(groupId, data.payments);
  if (parts.length === 0) return null;
  const amount = parts.reduce((sum, p) => sum + p.amount, 0);
  const customer = data.customers.find((c) => c.id === parts[0].customerId)?.name ?? "The customer";
  const products = parts.map((p) => data.sales.find((s) => s.id === p.saleId)?.product ?? "a sale");

  function confirm() {
    try {
      deletePayment(groupId);
      setOpen(false);
      showToast(`Payment deleted. ${customer} owes ${formatNaira(amount)} more.`);
    } catch {
      setError("This browser couldn't delete the payment. Try again.");
    }
  }

  return (
    <>
      <button type="button" onClick={() => { setError(null); setOpen(true); }} className="rounded-lg px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50">
        Delete<span className="sr-only"> the {formatNaira(amount)} payment from {formatDate(parts[0].date)}</span>
      </button>
      <ConfirmDialog
        open={open}
        title={`Delete this ${formatNaira(amount)} payment?`}
        confirmLabel="Delete payment"
        onConfirm={confirm}
        onCancel={() => setOpen(false)}
        error={error}
      >
        {parts.length > 1 ? (
          <p>This payment from {formatDate(parts[0].date)} was split across {products.join(" and ")}. Deleting it removes all of it.</p>
        ) : (
          <p>This payment from {formatDate(parts[0].date)} was for {products[0]}.</p>
        )}
        <p>{customer} will owe {formatNaira(amount)} more. This can&apos;t be undone.</p>
      </ConfirmDialog>
    </>
  );
}
