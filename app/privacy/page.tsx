import type { Metadata } from "next";
import { LegalShell } from "@/features/marketing/components/legal-shell";

export const metadata: Metadata = {
  title: "Privacy — BizBuddy",
  description: "How BizBuddy stores your business records: on your phone first, and backed up to your account.",
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy">
      <p>BizBuddy keeps your business records on your phone first, in this browser, so it works with no internet. That includes sales, payments, expenses, and customer names and phone numbers.</p>
      <p>When you create an account, those records are also stored on BizBuddy&apos;s server (hosted by Supabase), so they&apos;re backed up and you can open them on another phone. Only you can see your shop&apos;s records: each account can read and change its own shop, and nothing else. Your account uses your phone number and a password; we don&apos;t send you texts or emails.</p>
      <p>Without an account, your records stay only in this browser. Clearing this site&apos;s data, or using a different browser, removes them. Logging out removes your records from this phone; your account keeps its copy.</p>
      <p>When you confirm a note in Tell BizBuddy, that note and what you saved are remembered for your shop, so the next note is read the way you write. That memory stays with your account. It is not used for any other shop.</p>
      <p>Anyone who can open BizBuddy on your phone while you&apos;re logged in can see your records.</p>
    </LegalShell>
  );
}
