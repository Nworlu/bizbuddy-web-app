import type { Metadata } from "next";
import { LegalShell } from "@/features/marketing/components/legal-shell";

export const metadata: Metadata = {
  title: "Privacy policy — BizBuddy",
  description: "What BizBuddy keeps about your shop, where it is stored, and who can see it.",
};

const UPDATED = "30 September 2026";

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy policy" updated={UPDATED}>
      <p>
        BizBuddy is a book for a small shop. This policy says what is kept, where it lives, and who can see it. It covers the BizBuddy website and the app you open on your phone.
      </p>

      <section>
        <h2>What is kept</h2>
        <p>When you set up a shop, BizBuddy keeps your name, your phone number, the business name, and the type of shop.</p>
        <p>When you use the books, BizBuddy keeps the records you enter: sales, payments, expenses, and customer names and phone numbers. Dates and amounts are part of those records.</p>
        <p>When you create an account, BizBuddy also keeps a password. The password is stored by the account service in a form that cannot be read back. BizBuddy does not send you texts or emails.</p>
      </section>

      <section>
        <h2>On your phone first</h2>
        <p>
          The books are saved in this browser on this phone, so BizBuddy still opens with no internet. Closing the tab does not remove them. Clearing this site&apos;s data, or using another browser, starts empty.
        </p>
        <p>The pages of the app can be saved on the phone so they open offline. The business records are not part of that page cache. They stay in the browser&apos;s own storage.</p>
        <p>Anyone who can open BizBuddy on your phone while you are logged in can see the records.</p>
      </section>

      <section>
        <h2>Your account</h2>
        <p>
          An account is optional until you want a backup. With an account, the same records are also stored on BizBuddy&apos;s server, hosted by Supabase, so you can open them on another phone. Each account can read and change only its own shop.
        </p>
        <p>
          Your phone number is turned into a private login name for that account. Nothing is sent to that address. The sample shop, Ada&apos;s Fashion, is never copied to the server.
        </p>
        <p>
          Logging out removes the books from this phone. The account keeps its copy. If a change has not reached the account yet, logging out drops that change. Settings says so before you log out.
        </p>
        <p>
          Delete everything in Settings removes the shop from this phone. That button is hidden while you are signed in, because it would wipe the account&apos;s books. There is no button yet that deletes the account itself.
        </p>
      </section>

      <section>
        <h2>Tell BizBuddy</h2>
        <p>
          If you are signed in and online, a note you type is sent to OpenAI so it can be read. With the note, BizBuddy sends today&apos;s date, the names of your customers, and short lessons from notes you have already confirmed for this shop. The full books — every sale, payment, and balance — are not sent.
        </p>
        <p>
          Nothing is saved from a note until you confirm it. When you do, that note and what you saved are remembered for your shop, so the next note is read the way you write. Another shop never sees that memory. It stays with your account.
        </p>
        <p>Offline, or without an account, questions are answered on the phone from your books. Those questions are not sent to OpenAI.</p>
      </section>

      <section>
        <h2>WhatsApp</h2>
        <p>
          You can message BizBuddy on WhatsApp from the same phone number as your account. That message is read the same way as a note in the app: today&apos;s date, your customer names, and this shop&apos;s lessons go with it. The full books are not sent. BizBuddy replies in the chat and waits until you tap Save or Cancel before anything is recorded.
        </p>
        <p>
          The message is kept until you answer, so the reply can be finished. A confirmed note is then remembered for your shop, the same as in the app. A phone number that is not the account is told how to sign up. Customers are not given a chat. Voice notes and pictures are not read.
        </p>
        <p>WhatsApp, run by Meta, delivers those messages. BizBuddy uses it only to talk with the shop owner about their books.</p>
      </section>

      <section>
        <h2>Your customers</h2>
        <p>
          Customer names and phone numbers are kept so you can record a sale and a payment against the right person. You decide what to enter. Enter only what you need for the shop&apos;s books.
        </p>
      </section>

      <section>
        <h2>Who else sees it</h2>
        <p>BizBuddy does not sell records, and it does not use them for advertising. There are no advertising or analytics cookies.</p>
        <p>Supabase hosts the account copy. OpenAI reads a note when you use Tell BizBuddy or WhatsApp while signed in. WhatsApp, run by Meta, delivers the chat. They are used to run the product, not to build a profile of you for anyone else.</p>
        <p>Your login stays in this browser so you remain signed in. BizBuddy does not send a newsletter.</p>
      </section>

      <section>
        <h2>How long it stays</h2>
        <p>
          Records stay until you delete them on this phone, or until the account that holds the backup is removed. Lessons from confirmed notes stay with the account and are replaced as you confirm newer notes. The eight newest confirmed notes are kept.
        </p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>
          If this policy changes, the date at the top changes with it. The current version is always this page. The <a href="/terms">terms and conditions</a> say how the product may be used.
        </p>
      </section>
    </LegalShell>
  );
}
