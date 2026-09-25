import type { Metadata } from "next";
import { LegalShell } from "@/features/marketing/components/legal-shell";

export const metadata: Metadata = {
  title: "Terms — BizBuddy",
  description: "BizBuddy is a simple record book for your shop. You are responsible for the records you enter.",
};

export default function TermsPage() {
  return (
    <LegalShell title="Terms">
      <p>BizBuddy is a simple record book for a small shop. It helps you write sales, payments, and expenses, and see who still owes you.</p>
      <p>You are responsible for the records you enter. The totals come from those records. They are not tax advice, and they do not replace an accountant.</p>
      <p>This version is free and stores data only in your browser. If the browser clears that storage, the records go with it.</p>
    </LegalShell>
  );
}
