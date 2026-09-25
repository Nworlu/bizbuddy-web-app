import type { Metadata } from "next";
import { LegalShell } from "@/features/marketing/components/legal-shell";

export const metadata: Metadata = {
  title: "Privacy — BizBuddy",
  description: "BizBuddy stores your business records in this browser. They are not sent to a server.",
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy">
      <p>BizBuddy keeps your business records on this device, in this browser’s local storage. Sales, payments, expenses, and customer names are not uploaded to a BizBuddy server, because there is no account and no server yet.</p>
      <p>Clearing this site’s data, or using a different browser, removes those records from view. Anyone who can open this browser on this device can see them.</p>
      <p>This page will change when records move to an account. Until then, treat this browser as the book.</p>
    </LegalShell>
  );
}
