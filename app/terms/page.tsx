import type { Metadata } from "next";
import { LegalShell } from "@/features/marketing/components/legal-shell";

export const metadata: Metadata = {
  title: "Terms and conditions",
  description: "The terms for using BizBuddy to keep your shop's sales, money in, and spending.",
  alternates: { canonical: "/terms" },
  openGraph: { title: "Terms and conditions — BizBuddy", url: "/terms" },
};

const UPDATED = "1 October 2026";

export default function TermsPage() {
  return (
    <LegalShell title="Terms and conditions" updated={UPDATED}>
      <p>
        These terms are the agreement between you and BizBuddy when you use the website or the app. They are written for shop owners in Nigeria. Using BizBuddy means you accept them.
      </p>

      <section>
        <h2>What BizBuddy is</h2>
        <p>
          BizBuddy is a book for a small shop. You record what you sold, what came in, and what you spent. The totals are worked out from the records you enter.
        </p>
        <p>
          BizBuddy shows you those totals so the day is easy to see. An accountant still handles tax, and a bank still handles the money. BizBuddy does not file returns, give tax advice, or move money.
        </p>
      </section>

      <section>
        <h2>Your records</h2>
        <p>You are responsible for what you enter, and for keeping it accurate. A total is only as good as the sales, payments, and expenses behind it.</p>
        <p>
          Customer names and phone numbers you add are yours to enter. Add only people who belong in the shop&apos;s books. Do not use BizBuddy to keep records that are not yours.
        </p>
        <p>
          The books are saved on your phone first. With an account, they are also backed up so you can open them on another phone. The <a href="/privacy">privacy policy</a> says where that copy lives and who can see it.
        </p>
      </section>

      <section>
        <h2>Your account</h2>
        <p>
          You create an account with your phone number and a password. Keep the password to yourself. You are responsible for what happens on the account while it is signed in on a phone.
        </p>
        <p>
          There is no self-serve password reset yet. Logging out removes the books from that phone. If a change has not reached the account, it is dropped. Settings warns you first.
        </p>
      </section>

      <section>
        <h2>Tell BizBuddy</h2>
        <p>
          You can type what happened in your own words. BizBuddy shows what it understood and waits. Nothing is added to the books until you confirm it. You can correct the draft first. If the reading is wrong, do not save it.
        </p>
        <p>
          A confirmed note teaches BizBuddy how this shop writes. That memory is for your shop only. The money is still calculated by the app from the records, not guessed by the reader.
        </p>
        <p>
          The same thing works on WhatsApp, from the phone number on your account. Nothing is recorded until you tap Save or reply yes. A different number is not connected to your shop. A voice note is heard as words and then handled like a message you typed.
        </p>
      </section>

      <section>
        <h2>The sample shop</h2>
        <p>
          Ada&apos;s Fashion is a sample, so you can look through a day that is already filled in. Opening it asks before it replaces records already on this phone. The sample is not copied to an account.
        </p>
      </section>

      <section>
        <h2>Price</h2>
        <p>The books on the website are free. Each shop gets 15 test messages on Tell BizBuddy and WhatsApp. After that, the website still records sales, payments, and spending. WhatsApp notes, reminders to collect what you're owed, and the Sunday summary wait until a subscription is ready. There is no card to enter yet. If a paid version is offered later, BizBuddy will say so before you are asked to pay, and will message you on WhatsApp when it is ready.</p>
      </section>

      <section>
        <h2>The service</h2>
        <p>
          BizBuddy is provided as it is. A phone can run out of storage, a browser can clear site data, and a connection can fail. Keep your own copy of anything you cannot afford to lose, and use an account if you want the backup.
        </p>
        <p>
          BizBuddy may change, pause, or stop the product. Records already saved on your phone stay on that phone until you delete them or the browser removes them. The account copy stays until you delete the account in Settings, or the account is removed.
        </p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>If these terms change, the date at the top changes with it. Continuing to use BizBuddy after that date means you accept the new terms. The current version is always this page.</p>
      </section>
    </LegalShell>
  );
}