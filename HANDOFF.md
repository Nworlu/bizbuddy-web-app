# BizBuddy: Handoff

_Last updated: 30 Sep 2026_

## Where things stand

The V0.1 web app is in `bizbuddy-web-app/`. **Done:** the public landing page, onboarding, the app shell, the dashboard, Record Sale, the Sales list, Sale Details with Record Payment, Customers (list, customer page with Record Payment, Add Customer), Expenses (list with period filter and category totals, Record Expense), Ask BizBuddy, Settings (edit business details, record counts, sample shop, delete everything), editing or deleting sales, payments, expenses, and customers, the polish from the review, a Custom date range, an offline banner, and a PWA that installs on the home screen and opens with no internet. Every V0.1 screen and spec item is built.

**Built since V0.1:**
- **Accounts and offline sync** (Supabase, phone + password). See decision 21.
- **Tell BizBuddy**: type a note, and the AI (OpenAI) reads it into draft sales, expenses, and payments. See decision 22.
- **WhatsApp**: the owner texts BizBuddy's number, gets back what was understood with Save / Cancel, and Save records it in their books. See decision 23.
- **A WhatsApp welcome message** on first sign-up. See decision 24.
- **Sale or expense?**, **auto-save**, **asking for missing details**, and **reminders**, on WhatsApp and in Tell BizBuddy. See decisions 25–31.
- **Subscription, marked coming soon.** The landing page and `/billing` show three plans: Books at ₦0, Shop at ₦8,000 a month, and Counter at ₦15,000 a month. Counter is marked recommended. Nothing charges. The dashboard card points at Counter. Nav links on the landing page scroll to the section.
- **A test of 15 messages per shop** on Tell BizBuddy and WhatsApp (a note, a voice note, a photo, or a website). Save and Cancel do not count. The 15th note tells that shop it was the last one: the website stays free for sales, payments, and spending; a subscription later brings WhatsApp notes, reminders to collect what's owed, and the Sunday summary. Further notes get that explanation and are not read. Evening check-ins and the Sunday summary stop for that shop. When `WHATSAPP_SUBSCRIPTION_TEMPLATE` is set, the reminder scheduler messages each waiting shop once that a subscription is ready (`features/whatsapp/server/subscription.ts`). The count is `trialUsed` in that shop's memory, so no new migration.

**What's happening now (30 Sep 2026):** WhatsApp is being tested live on **Meta's test number**. The app runs on the laptop (`next start -p 3600`) behind an **ngrok** tunnel, and Meta's webhook points at that tunnel. Tested so far:
- The welcome message arrives on sign-up, using Meta's `hello_world` template.
- A note sent on WhatsApp gets a draft reply with Save / Cancel.

**Tested on the phone (30 Sep):** a reminder set on WhatsApp ("Remind me in 10 minutes to check the scheduler") was saved, sent by the Supabase scheduler, and delivered.

Built, **not yet tried on a phone**:
- A "typing…" indicator, and a faster reply (decision 23).
- **Sale or expense?** When a person who isn't a customer yet "sent money for" something, BizBuddy asks. It also learns who is on the team (decision 25).
- **Auto-save**, offered after 10 notes in a row saved without changes, with an Undo on every note it saves by itself (decision 26).
- **Asking for missing details** (who bought it, what was sold, how much), and **reminders** about notes never saved or cancelled (decision 27).
- **Reminders the owner sets** ("remind me Friday at 10am to collect from David"), sent on WhatsApp, and a choice of when to be reminded about unsaved notes (decision 28). Reminders due more than 24 hours after the owner's last message need the `bizbuddy_reminder` template.
- **Check-ins** (7pm nudge, Sunday weekly summary) and **learning the business from screenshots, photos, a website, and social handles** (decisions 30–31). **The scheduler runs inside Supabase (pg_cron, migration 0009), and works.**
- **The AI knows the owner and the business** (decision 29): name, shop, type, and a new "What does your business do?" field, sent with every note on WhatsApp and in Tell BizBuddy.
- **The chat follows the last thing said** (decision 23, 1 Oct): "what of today?", "break it down", "I just told you", and "who is my best customer?" stay on the thread. Needs migration **0010** in Supabase before a live chat keeps that thread.

The details are in **Current setup** below.

**Next:**
1. Re-test the reply speed.
2. Commit the latest work (see Next steps).
3. Deploy to Vercel so the webhook stops depending on the laptop.
4. Move from the test number to BizBuddy's real number.

The original build order comes from `BizBuddy_Web_App.md` §50.

GitHub: https://github.com/Nworlu/bizbuddy-web-app (`origin`, branch `main`). The last pushed commit is `be5a6f8` (privacy and terms). This file is the handoff. A copy is committed at `bizbuddy-web-app/HANDOFF.md` so GitHub stays current. After each feature, update this file, copy it into the app, and commit the app code.

## Source documents

| File | What it is |
|---|---|
| `BIZBUDDY_PLAN.md` | Product plan: vision, V0.1 scope, data model, roadmap, Definition of Done |
| `BizBuddy_Web_App.md` | UX spec: information architecture, screen layouts, user journeys, states, build order |
| `Start Web App Design (Copy)/` | Figma Make export (Vite + React). **Visual reference only.** Don't copy its logic; it has the bugs listed below. |

## Running it

```bash
cd bizbuddy-web-app
npm run dev        # http://localhost:3000
./node_modules/.bin/tsc --noEmit && npm run lint && npm test && npm run build
```

Use the project's TypeScript binary. `npx tsc` can install an unrelated package.

Tests use **Vitest 4** (`npm test`, or `npm run test:watch`). Test files sit next to the code they cover (`*.test.ts`): `shared/lib/{dates,format,finance,store}.test.ts` and `features/ask/lib/answer.test.ts`. They fix the clock to Tuesday 29 Sep 2026 with `vi.useFakeTimers`, because the demo shop is dated relative to today. The store tests swap in an in-memory `window.localStorage`, including one that refuses to save. Vitest 5 needs `@types/node` 22+, and this project pins 20, which is why it's on Vitest 4. Add a test with every new rule in `finance.ts` or `store.ts`.

`/` is the public landing page. It stays visible even when a shop already exists. Every "Start your books" link goes to `/welcome`. The sample shop is `/welcome?demo=1`.

`/welcome` is three steps: welcome, name and phone, then business name and type. Phone is stored on the business. If a shop already exists, `/welcome` redirects to `/dashboard`. `?demo=1` never loads anything by itself: it shows a screen with an "Open the sample shop" button, and if this browser already holds a shop it asks before replacing it ("Keep <shop>" or "Delete my records and open the sample"). "Try with demo data" on the first step loads the sample directly, because no shop exists yet. The page reads `?demo=1` with `useSearchParams`, so `app/welcome/page.tsx` wraps it in `<Suspense>`; without it `npm run build` fails. The shell still redirects to `/welcome` when there is no business. To start fresh, clear localStorage (key `bizbuddy:v1`) and open the app again.

Records live in this browser first. Without an account, another phone, another browser, or cleared site data starts empty. With an account (Settings → Back up), they sync to Supabase and come back on any phone after logging in (decision 21).

To test WhatsApp locally you need a public HTTPS address for the webhook:
1. Run `npm run build && npx next start -p 3600` and `ngrok http 3600`.
2. Put `https://<ngrok>/api/whatsapp` in Meta: App dashboard → WhatsApp → Configuration → Webhook, with `WHATSAPP_VERIFY_TOKEN`, subscribed to `messages`.

The free ngrok address changes every time ngrok restarts, and the webhook URL in Meta must be updated each time. `npm run dev` works too, but it is slower to answer.

## Stack

- **Next.js 16.3.6** (App Router, Turbopack), React 19.2, Tailwind v4, TypeScript.
- **Next 16 has breaking changes.** Per `AGENTS.md`, read `node_modules/next/dist/docs/` before using a Next API. For example, `params` is a Promise, and `LayoutProps<"/">` is a global type.
- **Font:** Outfit, via `next/font/google`. It comes from the Figma design; the UX doc suggests Inter.

## Code map

Routes in `app/` are thin. A route imports a screen; the screen owns its UI.

```
app/
  page.tsx                     public landing page (title, description, FAQ and app schema)
  robots.ts, sitemap.ts        search engines: home, privacy, and terms only
  opengraph-image.tsx          link-preview image (the shop mark plus the headline)
  welcome/page.tsx             onboarding (welcome, name + phone, business); demo via ?demo=1
  privacy/page.tsx, terms/page.tsx  privacy policy and terms; phone-first books, the account backup, Tell BizBuddy, and WhatsApp
  (app)/layout.tsx             AppShell
  (app)/dashboard/page.tsx     dashboard  (not / — that URL is the landing page)
  (app)/sales/page.tsx         sales list
  (app)/sales/new/page.tsx     Record Sale; ?customer=<id> fills in the customer
  (app)/sales/view/page.tsx    sale details (?id=): record or delete a payment, delete the sale
  (app)/sales/edit/page.tsx    edit a sale (?id=): customer, product, total, date
  (app)/customers/page.tsx     customers list, who owes what
  (app)/customers/view/page.tsx  customer page (?id=): totals, history, record payment (oldest sale first)
  (app)/customers/new/page.tsx add customer
  (app)/customers/edit/page.tsx  edit a customer (?id=): name or phone, or delete one with no sales
  (app)/expenses/page.tsx      expenses list: period filter, total, per-category totals, search
  (app)/expenses/new/page.tsx  Record Expense
  (app)/expenses/edit/page.tsx edit or delete an expense (?id=), same form as Record Expense
  manifest.ts, apple-icon.png  install on the home screen (icons in public/)
  (app)/ask/page.tsx           Tell BizBuddy chat; follows the last few lines; reads ?q= from the dashboard (Suspense for useSearchParams)
  api/tell/route.ts            POST: the AI reads a note (signed-in users only), with the recent chat and whether socials are saved
  api/whatsapp/route.ts        WhatsApp Cloud API webhook: GET verify, POST signed messages, with the recent chat and what this shop has already confirmed
  api/whatsapp/welcome/route.ts  POST: sends the signed-in owner the WhatsApp welcome template, once per account
  api/account/route.ts         DELETE: removes the signed-in account and the shop that hangs off it
  api/tell/learn/route.ts      POST: what the owner did with a draft (saved / corrected / cancelled / undone / auto); remembers it, counts toward auto-save
  api/tell/autosave/route.ts   GET / POST: the auto-save setting for the signed-in shop
  api/tell/knowledge/route.ts  GET / PATCH / POST: what BizBuddy knows (description, products, socials); read a picture or website; save
  api/whatsapp/remind/route.ts GET (scheduler, CRON_SECRET): due reminders, and one reminder per note left waiting on Save / Cancel
  api/reminders/route.ts       GET / POST / DELETE / PATCH: the signed-in owner's reminders and unsaved-note setting (phone from the login)
  (app)/billing/page.tsx       Billing: current plan (Books, free), Shop coming soon, payment method, invoices, next charge. Nothing charges.
  (app)/settings/page.tsx      Settings: account (back up / status / log out / delete account), business details, record counts, sample shop, delete everything
  login/page.tsx               log in with phone + password

features/
  marketing/                   landing screen, FAQ, legal shell
  onboarding/                  welcome screen
  shell/                       app shell, useBiz()
  dashboard/                   dashboard screen
  sales/                       sales list, Record Sale, sale details, edit sale
  customers/                   customers list, customer page, add and edit customer, CustomerAvatar
  expenses/                    expenses list, Record Expense
  ask/                         lib/answer.ts: answers from the books (keyword matcher + answerTopic), including yesterday, last week, and who bought the most
  tell/                        Tell BizBuddy: screen, draft cards, lib/intents.ts (schema, toDraft), lib/memory.ts (what this shop has confirmed, its team, auto-save state), lib/autosave.ts (when to offer, what still asks, undo), lib/drafts.ts (check / describe / apply, MISSING questions), lib/client.ts, server/interpret.ts (OpenAI), server/memory.ts
  settings/                    settings screen, account section
  account/                     login screen
  checkins/                    lib/checkins.ts (when due, evening text, weekly summary), server/store.ts (claims, owners who chat)
  reminders/                   lib/when.ts (Lagos time ↔ UTC, dueFrom, formatWhen, snooze, the numbered list), lib/client.ts, server/store.ts (secret key), components/reminder-card.tsx
  whatsapp/                    lib/conversation.ts (one message, start to finish; everything outside comes in as Deps, so tests fake it), lib/thread.ts (follow-ups from the last few lines), lib/person.ts (who the chat is with), lib/text.ts (replies, Save/Cancel words), server/meta.ts (signature check, send text/buttons/template, typing indicator), server/books.ts (Supabase with the secret key), server/who.ts

shared/
  ui/                          logo (public/logo.png; favicon and home-screen icons are the same mark), icons, period-filter (with usePeriodRange), confirm-dialog, delete-payment-button, offline-banner, service-worker, whatsapp-opt-in  (used by more than one feature)
  lib/
    types.ts                   data model
    actions.ts                 withSale(), withCustomerPayment(), withExpense(): the record rules shared by the app, Tell BizBuddy, and WhatsApp
    phone.ts                   Nigerian phone numbers -> 234XXXXXXXXXX -> private login name, and back (phoneFromLoginEmail)
    sync.ts                    offline-first sync: outbox, diff, row mapping, merge, syncOnce() (no Supabase code)
    supabase.ts                Supabase client + the RemoteApi syncOnce() uses; null without env keys
    account.ts                 createAccount(), logIn(), logOut(), deleteAccount()
    sync-runner.ts             runs syncOnce() in the background; useSyncStatus()
    store.ts                   localStorage store (books + outbox in one entry) + useBizData() + useSyncMeta() + linkShopToAccount() + joinAccount() + unlinkPhone() + syncIO + createBusiness() + recordSale() + recordPayment() + addCustomer() + recordCustomerPayment() + recordExpense() + updateBusiness() + resetAll() + updateSale() + deleteSale() + deletePayment() + updateExpense() + deleteExpense() + updateCustomer() + deleteCustomer()
    toast.ts                   showToast(); the shell listens and shows it
    finance.ts                 ALL money calculations (pure functions)
    dates.ts                   local-date helpers, period ranges
    format.ts                  formatNaira, formatDate, greeting
    demo.ts                    Ada's Fashion sample data, dated relative to today
```

A feature holds `screen/`, and `components/`, `hooks/`, `types/`, `content/`, or `lib/` (logic only that feature uses) only when that feature has something to put there. Do not add empty folders. `shared/ui` is for UI used by more than one feature. `shared/lib` is cross-feature logic, not UI.

## Key decisions (keep these)

1. **Payments are the single source of truth for money received.** A `Sale` stores `totalAmount` only. Every naira received is a `Payment` with a `saleId`, including money paid at the time of the sale.
   - Sale balance = total − payments for that sale.
   - Customer balance = sum of that customer's sale balances.
   - **This differs from `BIZBUDDY_PLAN.md` §17**, which puts `amount_paid` on `sales`. We changed it because the Figma version stored both and its sale and customer balances disagreed.
2. **Every financial number comes from `shared/lib/finance.ts`.** The functions are pure and deterministic, and no AI is involved (`BIZBUDDY_PLAN.md` §18). Pages must not do their own sums.
3. **"Collected" means payments dated inside the period**, including payments against older sales.
4. **"Customers Owing" ignores the date filter.** It is the current balance, and the card says "all time."
5. **Dates are local `YYYY-MM-DD` strings** (`shared/lib/dates.ts`), never `toISOString()`, which is UTC. Nigeria is UTC+1, so UTC dates are wrong between midnight and 1am. Parse with `formatDate()`, not `new Date("YYYY-MM-DD")`.
6. **All data access goes through `shared/lib/store.ts`.** Right now it's `useSyncExternalStore` over localStorage. The server snapshot is `undefined`, which means "loading", so the shell shows a skeleton and there are no hydration mismatches. Moving to a real backend should change only this file.
7. **`commit()` throws if saving fails.** Callers wrap actions in try/catch and tell the user the browser could not save. Success for a sale uses `showToast()` and returns to the dashboard.
8. **Pages inside the shell use `useBiz()`** (`features/shell/hooks/use-biz.ts`), which returns `{ data, business }` and is never null. The shell renders its children only once a business exists.
9. **Mobile navigation:** Home, Sales, **+**, Customers, Ask, as in the UX doc §6. The **+** opens a sheet with New Sale, Expense and Customer. Settings is the gear in the mobile header. Expenses has no tab; you reach it from the dashboard card or the **+** sheet. The product owner may want to revisit this.
10. **Recent Activity** lists sales, *later* payments and expenses. A payment on the same day as its sale is shown as part of the sale, not as a separate row.
11. **Money is whole naira.** Forms read amounts with `parseNaira()` (`shared/lib/format.ts`), which accepts "85000", "85,000" or "₦85,000" and rejects kobo. The store rejects non-integers too. Amounts are displayed rounded to whole naira, so a stored ₦4,999.50 showed as ₦5,000 and then refused a ₦5,000 payment.
12. **Never replace records without asking.** `loadDemoData()` wipes everything. Call it only from a button, never from an effect, and confirm first when `hasRecords()` or a business exists.
13. **A customer payment pays the oldest unpaid sale first** (`allocatePayment()` in `finance.ts`). It is saved as one `Payment` per sale, all sharing a `batchId`, and `laterPayments()` joins them back so the customer page and Recent Activity show one payment. A payment can only cover sales dated on or before the payment date (`owedOn()`). A payment from a sale page still goes to that one sale.
14. **Customer names are unique, ignoring case and extra spaces anywhere in the name** (`findCustomerByName()`). New names are saved with spaces tidied ("Sarah  Ibrahim" becomes "Sarah Ibrahim"). Record Sale reuses the existing customer; Add Customer refuses a duplicate and links to the existing one.
15. **Ask BizBuddy is keyword matching, not AI** (`features/ask/lib/answer.ts`). It answers the V0.1 questions in `BIZBUDDY_PLAN.md` §13: who owes me, how much a named customer owes or bought, sales, expenses, and money collected, for today, this week, this month (the default), or last month. Every number comes from `finance.ts`. Anything else gets suggested questions. The chat is not saved.
16. **Fixing mistakes keeps the money honest.** Every delete asks first (`shared/ui/confirm-dialog.tsx`). Deleting a sale deletes its payments. A sale that received part of a split payment can't be deleted or moved to another customer until that payment is deleted, so received money never disappears silently. A sale's total can't drop below what's been paid, and its date can't be after a payment on it. A split payment is deleted whole. Payments can't be edited: delete and record again. A customer with sales can't be deleted: delete or move their sales first.
17. **Periods.** The dashboard and Expenses share `usePeriodRange()` and `<PeriodFilter>` (`shared/ui/period-filter.tsx`): Today, This Week, This Month (the default), Last Month, and Custom with From and To dates (no future dates; picked out of order, they're swapped by `customRange()`). Sentences use `periodPhrase()` ("this month", "from 1 Sept 2026 to 15 Sept 2026"). Ask BizBuddy uses the presets only.
18. **Offline.** `<OfflineBanner>` in the app shell shows while `navigator.onLine` is false. It says BizBuddy still works and records are saved on this phone. It must never say anything was synced; whether changes reached the account is shown only by `SyncBadge` (decision 21).
19. **BizBuddy is a PWA and every page is static.** Record pages take the id from the query string (`/sales/view?id=…`, built by `shared/lib/routes.ts`), never the path: a `/sales/[id]` page is built per id on the server, so a sale recorded offline could not be opened. Don't add dynamic `[param]` routes or read `searchParams` in a page's server component; read `?id=` with `useSearchParams` in a client "Route" component inside `<Suspense>`. `npm run build` should list every route as ○ (Static).
20. **The service worker** is `public/sw.js`, registered by `shared/ui/service-worker.tsx` in production only. On install it saves every page listed in `APP_PAGES` plus the scripts and styles each uses. Pages are network-first with a 3-second timeout, then the saved copy (ignoring the query string); `/_next/static` is cache-first; business records are never cached here. **When you add a page, add it to `APP_PAGES`.** Bump `VERSION` when the caching rules change. To test offline: `npm run build && npx next start -p 3200`, open it, wait for the service worker, then stop the server and keep using the app. The service worker doesn't run under `npm run dev`.
21. **Accounts and sync.** Supabase, phone number + password. Supabase's own phone login needs a paid SMS code. Instead, `shared/lib/phone.ts` turns 0803 123 4567 into a private email login: a plus-address of the mailbox in `NEXT_PUBLIC_LOGIN_EMAIL`, e.g. `jehoshaphategbe1+2348031234567@gmail.com`.
   - Why a plus-address: the first plan, `@users.bizbuddy.app`, was rejected by Supabase (`email_address_invalid`). That domain belongs to someone else and has no mail server.
   - Nothing is ever emailed. **The Email provider must be ON and "Confirm email" OFF** (Authentication → Sign In / Providers → User Signups; it is not inside the Email panel). If confirmation is on, sign-up returns no session.
   - `phoneFromLoginEmail()` turns the login back into the phone number. The WhatsApp welcome uses it, so the number is never taken from what the browser sends.
   - The books stay in localStorage first, so everything works offline. Linked to an account, every change is also queued in an outbox. The books and the outbox are saved in **one** localStorage entry, so neither can be saved without the other.
   - `syncOnce()` sends the outbox, then pulls rows the server changed since the last pull (with a 60-second overlap). A change still in the outbox beats the pulled copy. The server's `updated_at` decides what's new, never the phone's clock. Deletes are sent as `deleted = true`.
   - Record ids are made on the phone; on the server the key is `(business_id, id)`. Row level security lets each user reach only their own shop (tested on Postgres in `supabase/migrations/0001_bizbuddy.sql`'s rules).
   - The sample shop is never sent. It can't be opened while signed in, and "Delete everything" is hidden while signed in (log out instead). Logging in refuses to replace books that aren't in an account. Logging out removes the books from the phone and warns if changes haven't reached the account.
   - **Delete account** (Settings, while signed in) calls `DELETE /api/account`. The server takes the user from the access token and the phone from that login, never from the request. It deletes that shop's customers, sales, payments, expenses, memory (reminder settings, check-ins, pages), reminders, drafts, and check-ins, then the shop row itself, which is the settings record (name, owner, phone, type, what the shop does). It clears the phone-only rows (`whatsapp_chats`, `whatsapp_thread`), the welcome row (`whatsapp_welcomes`), and the WhatsApp message ids that belong to that number. Then it deletes the auth user. The settings, the books, and the Tell BizBuddy chat are removed from this phone. It cannot be undone.
   - The UI never says "Backed up" until the server has confirmed (UX spec §28). Status shows in the sidebar and mobile header (`SyncBadge`).
   - Without `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (see `.env.example`), accounts switch off and the app works on the phone only, as before.
   - **Setup:**
     1. Create a Supabase project.
     2. Run every file in `supabase/migrations/` in order (0001–0005) in its SQL editor.
     3. Turn off "Confirm email" (see above).
     4. Put the project URL, publishable key, and `NEXT_PUBLIC_LOGIN_EMAIL` in `.env` locally, and in Vercel's environment variables.

     The secret key (`SUPABASE_SECRET_KEY`) is for server routes only (WhatsApp). Never use it in browser code.
   - Password reset isn't built: "Forgot your password?" says to contact BizBuddy. Resetting means changing it in the Supabase dashboard (Authentication → Users).
22. **Tell BizBuddy** (`/ask`, `features/tell/`). The owner types a note ("Sold 2 shoes to David for 85k, he paid 50k"); `POST /api/tell` sends it to an AI model and gets back actions: sale, expense, payment, question, or unclear. **Provider:** OpenAI only (`OPENAI_API_KEY`, model `OPENAI_MODEL`, default `gpt-5.4-mini`, low reasoning effort, strict JSON schema) in `features/tell/server/interpret.ts`. The same reader is what WhatsApp will call. There is no Claude fallback. The chat follows the last few lines (`features/tell/lib/talk.ts`, kept on this phone as `bizbuddy:tell-thread`). "What of today?", "break it down", and "are you connected to my socials?" are answered the same way as on WhatsApp, from the books and the saved handles. Those lines also go with the next note, so anything else stays in the conversation.
   - **The AI only reads; the app decides.** It never sees the books, only the note, today's date, and customer names (to match "David" to "David Okafor"). It never calculates: a unit price and quantity come back as said, and `toDraft()` works out the total. Questions come back as a topic and `answerTopic()` answers from `finance.ts`.
   - Every sale, expense, or payment is shown as an editable **draft card**; nothing is saved until Save, which uses the normal store functions and rules.
   - Needs a signed-in account (the route checks the Supabase access token, so strangers can't spend the AI key) and a connection. Offline or without an account, the screen falls back to the keyword question matcher (`answerQuestion()`).
   - The API keys are server-only (`.env` locally, Vercel env in production; never `NEXT_PUBLIC_`). The route rate-limits to 30 notes per user per 10 minutes per server instance.
   - WhatsApp uses the same reader (decision 23). The draft rules (`checkDraft`, `describeDraft`, `applyDraft`) are in `features/tell/lib/drafts.ts`, so both use the same checks.
   - **"for" means the total.** "2 sneakers for 85k" is quantity 2 with a total of 85,000. Only "each", "per", "a piece", "apiece", or "@" makes it a unit price. This rule was added to the instructions after one WhatsApp reply came back with "Total: ?". Afterwards, 7 of 7 test phrasings were read correctly.
   - **Who the chat is with.** WhatsApp is for the shop owner running the business, not for buyers. The sender's number must be the account (`business_for_login`). The reply uses that owner's name and shop. A customer saved in the books is not given a chat that tells them what they owe. If the owner was just recording a sale or payment for one customer, the next note can stay on that customer until they name someone else (`whatsapp_focus`). `features/whatsapp/lib/person.ts` does that; `whoIsChatting()` loads it.
   - **It learns this shop.** Each note the owner confirms (after any corrections on the draft) is remembered for that shop only (`shop_memory`, `supabase/migrations/0003_shop_memory.sql`). The next note is sent with those lessons (`features/tell/lib/memory.ts`). The eight newest notes are kept, plus the products they sell and whether they write “85k”. Another shop never sees it. The model still does not do the money maths. Run `0003_shop_memory.sql` in the Supabase SQL editor before this works on a real account. Without the table, reading a note still works; the lesson is just not saved.
23. **WhatsApp** (`app/api/whatsapp/route.ts`, `features/whatsapp/`). The shop owner messages BizBuddy's WhatsApp number from the phone number of their account; `business_for_login` (migration 0002) finds their shop from the account's login, never from a number typed in the app. Other numbers are told how to sign up; customers are not chatted with.
   - Flow (`features/whatsapp/lib/conversation.ts`): the same reader as Tell BizBuddy, plus who the chat is with and shop memory → a reply with what was understood (`describeDraft`, the app's own sums) and **Save** / **Cancel** buttons, or typed yes / no. Save re-checks against the books as they are then (`checkDraft`) and records with the shared rules (`shared/lib/actions.ts`, `applyDraft`); phones get it on their next sync. Questions are answered from the books. A voice note is turned into text (`features/whatsapp/server/voice.ts`, OpenAI) and then read the same way. The audio is not kept. A picture of the shop's page can still be learned from.
   - The owner's chat stays on the last customer they named (`whatsapp_focus`), so "he paid 20k" goes to that person. Confirmed notes teach shop memory (`shop_memory`, migration 0003); the note is kept with the waiting drafts (migration 0004).
   - **The chat follows the thread** (`features/whatsapp/lib/thread.ts`, table `whatsapp_thread`, migration **0010**). The last eight lines are kept for that phone. Short follow-ups are answered from the books without another model call: "how much did I make yesterday?", then "what of today?" / "last week" / "last month" stays on sales; "who owes me?" then "break it down" or "I mean the money owed" lists the balances with what they bought; "who is my best customer?" is who bought the most; "what question can I ask you?" lists examples; "I am going to church" and "I just told you" answer that, instead of "I didn't catch a sale". "Are you connected to my socials?" is answered from the handles saved for this shop, or says none are saved yet. Anything else that isn't a record is a normal reply, not a menu. A note that records money still goes to the reader. The same lines are sent with the next note so the model can continue anything the rules don't cover. Questions can also be today, yesterday, this week, last week, this month, or last month (`questionRange` in `shared/lib/dates.ts`). Run `0010_whatsapp_thread.sql` in the Supabase SQL editor. Without the table, replies still go out; the next message just won't remember the last one.
   - Safety: only calls signed with `WHATSAPP_APP_SECRET` are accepted; each message id is handled once (`whatsapp_messages`); the server writes with `SUPABASE_SECRET_KEY` and only ever to the sender's shop. Meta gets its 200 at once and the reply goes out just after (`after()`, `maxDuration` 60).
   - Settings (server only): `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_APP_URL`, plus optional `WHATSAPP_WELCOME_TEMPLATE`, `WHATSAPP_TEMPLATE_LANGUAGE`, `WHATSAPP_GRAPH_VERSION` (default `v23.0`). Register `https://<app>/api/whatsapp` in Meta (WhatsApp → Configuration) with the verify token, subscribed to `messages`.
   - **Typing indicator.** The first thing done with a new message is `showTyping()`, which marks it read (blue ticks) and shows "typing…" in the owner's chat until the reply arrives, for up to about 25 seconds. If it fails, the reply still goes out.
   - **Speed.** Replies took about 12–15 seconds, for two reasons: the owner's books were loaded twice, and the database reads ran one after another. Now:
     - `whoIsChatting()` returns the books it already loaded.
     - The books, the owner's name, and shop memory load in parallel.
     - Most of the remaining time is the AI call plus Supabase round trips, which take about 1 second each from a laptop in Nigeria. They get shorter once the app is deployed on Vercel **in the same region as the Supabase project**.
   - **Meta rules that bit us:**
     - The test number messages only the up to 5 numbers on its "To" list (error `131030` otherwise).
     - A temporary token lasts 24 hours. We use a permanent System User token.
     - Messages Meta sends to the app's webhook reach the app only when the app is subscribed to that WhatsApp Business Account (WABA): `POST /<WABA_ID>/subscribed_apps` with the token. Registering the webhook URL is not enough. We found this out when no POSTs arrived.
     - BizBuddy can send free text only within 24 hours of the owner's last message. Anything it starts, like the welcome, must be an approved template.
24. **WhatsApp welcome on sign-up** (`app/api/whatsapp/welcome/route.ts`). Onboarding and Settings → Back up both show a ticked-by-default "Send me a welcome message on WhatsApp" box (`shared/ui/whatsapp-opt-in.tsx`). After the account is created, `sendWhatsAppWelcome()` (in `shared/lib/account.ts`) calls the route without waiting. A failed welcome never blocks sign-up.
   - The route checks the Supabase access token. It takes the phone number from the account's login (`phoneFromLoginEmail`), never from the request, so it can't be used to message other numbers.
   - It sends once per account: `whatsapp_welcomes` (migration 0005, no RLS policies, server-only) is claimed before sending and released if the send fails.
   - Template: `WHATSAPP_WELCOME_TEMPLATE`, default `bizbuddy_welcome`.
     - `bizbuddy_welcome` is a Utility template: {{1}} is the owner's first name, {{2}} is the shop name, and it has a quick-reply button "Hi BizBuddy". It was submitted on the test WABA and is **pending approval**.
     - Tapping the button greets the owner with how BizBuddy works. Any button that isn't Save/Cancel does this.
   - `hello_world` (Meta's sample) is special-cased: it gets no parameters and `en_US`. It **only sends from a public test number** (error `131058` on a real number). Language comes from `WHATSAPP_TEMPLATE_LANGUAGE`, default `en`.

25. **Which way the money went** (`settleDirection()` and `eitherDrafts()` in `features/tell/lib/intents.ts`). "Mordecai sent 85k for laptop" could be a customer paying the shop (a sale) or someone on the team spending shop money (an expense).
   - The reader's rules decide in order: a known customer, or buying words, means money coming in. A team member, or "for the shop / stock / supplier / rider", means an expense, with `spent_by`. The owner, or "I" / "we", means an expense. Anything else is an `either` action.
   - **The app doesn't trust the model on this.** After every read, `settleDirection()` turns a sale to someone *not in the customer list* into an `either`, unless the note says sold, bought, or ordered. The rules alone were not reliable: one wrongly saved lesson ("Jehoshaphat sent 85k for laptop…" saved as an expense) made the model copy "expense" 6 times out of 6.
   - An `either` shows both readings. WhatsApp shows **Save as sale** / **Save as expense** / **Cancel** (a typed "sale" or "expense" also works, and a plain "yes" asks again). Tell BizBuddy shows both draft cards.
   - Saving the expense reading adds the person to the shop's **team** (`shop_memory.team`). Their next "sent … for" is then read as an expense straight away. Someone later recorded as a customer leaves the team.
   - Lessons in shop memory only show how the owner writes. The rules say never to copy the *kind* (sale, expense, or payment) from a past note.
26. **Auto-save** (`features/tell/lib/autosave.ts`). The state is in shop memory (`streak`, `autoSave`: off / offered / on / declined), so WhatsApp and Tell BizBuddy share one count and one setting. No migration was needed.
   - **The count:** a draft saved exactly as BizBuddy read it adds 1. A correction, Don't save / Cancel, or Undo sets it back to 0. Picking "sale or expense" and auto-saves don't change it.
   - **The offer:** at `AUTO_SAVE_AFTER` (10) BizBuddy offers **once**: "Yes, auto-save" / "No, keep asking". Settings → Account has the switch. On WhatsApp the owner can also type "auto-save on" or "auto-save off".
   - **What still asks when it's on** (`needsAsking()`): payments, new customers, incomplete drafts, sale-or-expense, and big amounts. "Big" means more than double the largest of the shop's last 30 sales or expenses, or any amount while the shop has fewer than 5 records of that kind. A note is auto-saved only if **every** draft in it is safe.
   - **Undo:** WhatsApp's auto-save reply has an **Undo** button (or type "undo"). It works for the last auto-saved note only, and removes exactly the sales (with their payments) and expenses it added (`added()`, `undo()`). The stored undo rides in `whatsapp_pending`. Tell BizBuddy's auto-saved card has an Undo link, which uses `deleteSale` / `deleteExpense`.
   - Routes: `GET/POST /api/tell/autosave` (setting), `/api/tell/learn` (now takes `review`: saved, corrected, cancelled, undone, or auto; returns `offer`), and `/api/tell` (now also returns `autoSave`).
27. **Asking and reminding.**
   - **Missing details:** when every draft in a note is missing something a short reply can answer (`MISSING` in `features/tell/lib/drafts.ts`: who bought it, what was sold, how much), WhatsApp asks that question and keeps the note. A reply of 8 words or fewer is added to the note ("Sold shoes for 20k\n(Who bought it? David)") and read again, so the owner never retypes. Anything longer is a new note. Tell BizBuddy's cards show the question above the fields.
   - **Reminders on WhatsApp:**
     - A question sent while a note is waiting gets its answer, then "⏰ You haven't saved or cancelled this yet" with the note's buttons.
     - A new note to record replaces the waiting one, and BizBuddy says the earlier one wasn't saved.
     - **Timed:** `GET /api/whatsapp/remind` sends one reminder per note left waiting longer than `WHATSAPP_REMIND_AFTER_MINUTES` (default 30). It only sends inside the 24-hour window. It needs `Authorization: Bearer <CRON_SECRET>` and **a scheduler calling it every few minutes, which isn't set up yet**. Vercel Cron only runs more than once a day on the Pro plan; cron-job.org (free) works, also against ngrok.
   - **Reminders in Tell BizBuddy:** a banner above the input, "⏰ You haven't saved or cancelled N earlier notes", with **Show me**.
   - `whatsapp_pending.drafts` (jsonb) now also carries marker entries: `either`, `undo`, and `meta` (`asking`, `remindedAt`). `getPending` / `setPending` in `features/whatsapp/server/books.ts` pack and unpack them.

28. **Reminders the owner sets** (`features/reminders/`, migration **0006**: `reminders`, `whatsapp_chats`).
   - **Reading them:** the reader has a `reminder` action with `text`, `date`, `time` (HH:MM, Lagos), and `in_minutes` ("in 2 hours"). The user message now carries the time in Lagos. The app works out the instant (`dueFrom()`):
     - A day with no time means 9am.
     - A time with no day means today, or tomorrow if that time has passed.
     - No time at all: BizBuddy asks "When should I remind you?" and reads the short answer with the note, like a missing detail.
     - Nigeria is UTC+1 all year, so the conversion is a fixed hour.
   - **Setting them:** set straight away (the owner's choice), confirmed as "⏰ I'll remind you *Fri 2 Oct, 10:00am*: …" with **Cancel reminder**. In Tell BizBuddy the reminder card sets it, or asks for a day and time, with Cancel.
   - **Managing them:**
     - On WhatsApp: "my reminders" (numbered list), "cancel reminder 2".
     - In Settings → Reminders: the list with Cancel, and the unsaved-note choice.
     - The web goes through `/api/reminders`. It takes the phone number from the login and writes with the secret key, and the tables have no RLS policies, so no one can point a reminder at someone else's number.
   - **Sending them:** `/api/whatsapp/remind` (same scheduler) claims each due reminder, so it goes out once.
     - If the owner messaged BizBuddy in the last 24 hours (`whatsapp_chats.last_inbound_at`, recorded on every message), it's a normal message with **Done / In 1 hour / Tomorrow**.
     - Otherwise it must be the approved template `WHATSAPP_REMINDER_TEMPLATE` (default `bizbuddy_reminder`), whose two quick-reply payloads are filled per send.
     - A failed send is retried on the next run, for up to 12 hours.
   - **The template to submit in Meta** (Utility, English): name `bizbuddy_reminder`, body `⏰ Reminder: {{1}}`, two quick-reply buttons: `Done` and `Remind me tomorrow`. Sample for {{1}}: "Collect money from David". It's needed on the test WABA now, and again on the real one.
   - **Unsaved-note reminders:** each shop picks after 30 minutes (the default), after 2 hours, or never. It's stored as `unsavedReminder` in shop memory. Set it in Settings, or on WhatsApp ("remind me about unsaved notes after 2 hours", "stop reminding me"). Those phrases are matched before the AI, and the website's reader points them to Settings.

29. **The AI knows who it works for** (`features/tell/lib/profile.ts`, migration **0007** `businesses.about`).
   - `shopProfile()` says: the shop, its type, who runs it, and, in the owner's words, what the business is about. For example: "The shop is Jay Gadgets, an electronics business run by Jehoshaphat Egbe. In the owner's words, the business is about: “We sell fairly used laptops and iPhones in Ikeja, and fix screens”".
   - It goes with every note, alongside what shop memory has learned (products, team, lessons). On WhatsApp it's added to `chatWith`. On the website, `/api/tell` loads the business with the owner's token (`memoryFor()` returns `profile`). Before this, the website sent nothing about the owner, and WhatsApp sent only the name and shop.
   - The reader's rule: use the profile to name a vague item clearly and to tell a sale from an expense, but never invent a brand, model, amount, or customer. Measured: "Sold one 2017 to David for 450k" gives "2017" without the profile and "2017 laptop" with it. "Did one screen for Musa 25k" gives "screen repair". The 15-note regression is unchanged.
   - **"What does your business do?"** is optional. It's in onboarding (the business step) and in Settings → Business. It's tidied and capped at 300 characters, stored as `Business.about`, and synced as `businesses.about`.
   - **Safe before migration 0007:** `about` is only sent in the sync once it's filled in, and the business is read with `select("*")` in both the app and the WhatsApp server. Shops keep syncing whether or not the column exists. Once someone fills it in, the sync needs 0007.

30. **Check-ins** (`features/checkins/`, migration **0008** `check_ins`). BizBuddy writes first, only to owners who have messaged it at least once (`whatsapp_chats`).
   - **Evening:** from 19:00 to 21:30 Lagos time, on a day with nothing recorded: "Good evening Jehoshaphat 👋 How was business today?…"
   - **Weekly:** on Sunday in the same window, the week so far (Monday to today) from `periodSummary()`: sales, collected, spent, and who owes (top 3). It replaces that evening's nudge.
   - **Once only:** each check-in is claimed per shop, kind, and Lagos date (primary key), so it goes out once. A failed send releases the claim.
   - **Outside the 24-hour window** they use templates: `WHATSAPP_CHECKIN_TEMPLATE` (default `bizbuddy_checkin`, {{1}} first name, {{2}} shop) and `WHATSAPP_WEEKLY_TEMPLATE` (default `bizbuddy_weekly`, {{1}} shop, {{2}} sales, {{3}} collected, {{4}} spent, {{5}} owed). **Both still need submitting.** Meta may class them as Marketing rather than Utility.
   - **On by default.** Settings → Reminders has a switch for each. On WhatsApp: "stop check-ins" / "start check-ins". Stored as `checkIns` in shop memory.
31. **Learning the business from what the owner shows** (`features/tell/lib/knowledge.ts`, `features/tell/server/learn-business.ts`).
   - **Sources:**
     - A **screenshot or photo** (Instagram or TikTok page, WhatsApp catalogue, price list), sent on WhatsApp or uploaded in Settings → What BizBuddy knows (up to 3, shrunk to 1600px JPEG in the browser).
     - A **website link**, sent alone on WhatsApp or pasted in Settings.
     - The AI (OpenAI, same model, strict schema) returns a description and products with prices, and BizBuddy shows them with **Save / Cancel**. Nothing is kept until Save.
   - **Social links:** Instagram, TikTok, Facebook, and X / Twitter (x.com or twitter.com) links are **not read**; those sites block it, and an official Instagram connection needs Meta app review. The handle is saved (`socials`) and BizBuddy asks for screenshots instead. Handles can also be typed in Settings (Instagram, TikTok, Facebook, X (Twitter), website).
   - **Kept in shop memory:** `description`, `catalog` (up to 40, newest first), and `socials`. The AI gets the description, **product names only (never prices**, so a listed price can't become an amount the note didn't say), and the handles.
   - **Link safety:** only http(s) on ports 80/443, and no private, loopback, link-local, or metadata addresses (checked again on each redirect). 8-second timeout, 1 MB, HTML or text only. Tested: 127.0.0.1 and 169.254.169.254 are refused. One gap: the check resolves DNS separately from `fetch`, so a DNS-rebinding host could still slip past. Pin the resolved IP if this becomes a concern.
   - **Limits:** reading is limited to 20 per shop per 10 minutes per server instance. Pictures are capped at 5 MB, and the WhatsApp media size is checked before downloading.
   - **Measured:** a price-list image gave all 4 products with the right prices and a correct description. example.com gave nothing to learn.
32. **The scheduler runs in Supabase** (migration **0009**; tested 30 Sep: a reminder set on WhatsApp was sent by the scheduled run and delivered): `pg_cron` calls `public.bizbuddy_run_reminders()` every minute (it was every 5 minutes, but a reminder could then arrive up to 5 minutes late), which uses `pg_net` to call `GET <bizbuddy_remind_url>` with `Authorization: Bearer <bizbuddy_cron_secret>`. Both values live in **Supabase Vault**, never in the migration.
   - **Setup, after running 0009**, in the SQL editor (the secret is `CRON_SECRET` from `.env`):
     - `select vault.create_secret('https://<app>/api/whatsapp/remind', 'bizbuddy_remind_url');`
     - `select vault.create_secret('<CRON_SECRET>', 'bizbuddy_cron_secret');`
   - **When the address changes** (new ngrok, or Vercel): `select vault.update_secret((select id from vault.secrets where name = 'bizbuddy_remind_url'), '<new url>');`
   - **Checking it:** `cron.job_run_details` (runs) and `net._http_response` (the app's answers). To stop it: `select cron.unschedule('bizbuddy-reminders');`

## Styling rules

- The color tokens are in `app/globals.css` (`brand-*`, `surface`, `ink`, `ink-muted`).
- **Use `brand-700` and `amber-700` for text and buttons.** `brand-600` and `amber-600` fail WCAG AA contrast on white; use them for fills and accents only.
- Use Tailwind's named weights (`font-medium`, `font-semibold`, `font-bold`). **`font-600` and similar don't exist in Tailwind v4 and silently compile to nothing.** That's why the Figma export renders everything at normal weight.
- **Mobile grids need an explicit `grid-cols-1`.** An implicit column grows to fit long `truncate` text and causes sideways scroll. The dashboard is verified with no sideways scroll at 320px and 390px wide.
- **Accessibility:** use `<Link>` or `<button>` for anything clickable, never a clickable `div`. Link every `<label>` to its input with `htmlFor`, and use `aria-invalid` and `aria-describedby` for errors. Show paid versus owing with text, not color alone.

## Current setup (as of 30 Sep 2026)

None of these IDs are secrets. The tokens and keys live only in `.env` (git-ignored); `.env.example` lists every name.

**Supabase**
- Migrations **0001–0009 have all been run** (checked 30 Sep: `reminders`, `whatsapp_chats`, `check_ins`, and `businesses.about` exist). **0010** (`whatsapp_thread`) has not been run yet. Run `supabase/migrations/0010_whatsapp_thread.sql` in the SQL editor so WhatsApp can keep the chat.
- **Vault secrets are set:** `bizbuddy_remind_url` (the current ngrok address + `/api/whatsapp/remind`) and `bizbuddy_cron_secret`. **When ngrok restarts, update `bizbuddy_remind_url`** (decision 32) as well as Meta's webhook.
- **The scheduler works:** pg_cron calls `/api/whatsapp/remind` and the app answers 200. Supabase was set up on the 5-minute schedule. The migration file now says every minute; to switch the live job, run `select cron.schedule('bizbuddy-reminders', '* * * * *', $$select public.bizbuddy_run_reminders()$$);` (it replaces the job).
- "Confirm email" is off.

**Accounts**

One account is kept on purpose: nworluegbe@gmail.com.

The account for 0811 295 9740 (Jehobyte) was deleted on request on 1 Oct 2026. A new account for that same number was created later that evening and is kept. The account for 0811 295 9840 was deleted earlier.

**Meta / WhatsApp**

| What | Value |
|---|---|
| App ("Bizbuddy") | `1484328866852913` |
| Test WABA | `1104879972136785`. The Bizbuddy app is subscribed (`subscribed_apps`). |
| Test phone number | +1 555-157-6196, phone number ID `1342636065599193`. Only delivers to numbers on the API Setup "To" list. |
| Real number | +254 706 931455, phone number ID `1361836510344909`. **This is what `.env` uses now**, so sends go out from BizBuddy. The same value has to be `WHATSAPP_PHONE_NUMBER_ID` on Vercel, then redeployed, or the live site still sends from whichever id is saved there. |
| Access token | Permanent System User token (System User "bizbuddy-server"), in `WHATSAPP_ACCESS_TOKEN` |
| Test "To" list | The owner's numbers, added in WhatsApp → API Setup (max 5) |
| Webhook | `https://<current ngrok>/api/whatsapp`, set at app level, field `messages` |
| Templates | `bizbuddy_welcome` is pending on the test WABA. `.env` has `WHATSAPP_WELCOME_TEMPLATE=hello_world` for now. **Being submitted:** `bizbuddy_reminder`, `bizbuddy_checkin`, and `bizbuddy_weekly`; exact wording in **Templates to submit** below. |

**Laptop**
- `next start -p 3600` with the latest build (typing indicator, speed, and the "for" rule).
- ngrok is forwarding to it.
- `NEXT_PUBLIC_APP_URL` is not set yet. Unknown numbers get the sign-up message without a link until it is.

**Code**
- 265 tests pass.
- Everything up to sale-or-expense, auto-save, asking, and unsaved-note reminders is committed (`94a874d`).
- `CRON_SECRET` is in `.env`. No scheduler calls `/api/whatsapp/remind` yet.
- **Not committed yet:** reminders, the shop profile, check-ins, learning the business, and the scheduler (decisions 28–32).
- The shop's memory still holds the "Jehoshaphat sent 85k for laptop…" = expense lesson from testing. It no longer steers new notes: `settleDirection()` and the Mordecai sales you saved since override it. It drops off after 8 newer notes.

**Templates to submit** (WhatsApp Manager → Message templates, on the test account now and again on the real one; language **English `en`**, not English (US); variable type Number; no header or footer). They're only used when the owner hasn't written to BizBuddy for 24 hours; inside that window the app sends normal messages. Names and blank order must match the code.

| Name | Category | Body | Samples | Buttons |
|---|---|---|---|---|
| `bizbuddy_reminder` | Utility | `⏰ Reminder: {{1}}` | Collect money from David | Quick replies, in order: `Done`, `Remind me tomorrow` |
| `bizbuddy_checkin` | Utility (Meta may make it Marketing) | `Hi {{1}}, how was business at {{2}} today? Tell me anything you sold or spent, and I'll record it.` | Jehoshaphat · Jay Gadgets | none |
| `bizbuddy_weekly` | Utility (Meta may make it Marketing) | `Your week at {{1}}: sales {{2}}, collected {{3}}, spent {{4}}. Customers owe you {{5}} in total. Reply with anything I missed.` | Jay Gadgets · ₦450,000 · ₦300,000 · ₦45,000 · ₦150,000 | none |
| `bizbuddy_welcome` | Utility | (submitted earlier; pending) | first name · shop | Quick reply `Hi BizBuddy` |

## Next steps

1. **Try it on the phone.**
   - "typing…" and the speed.
   - A "sent … for" note from someone new: it should ask sale or expense.
   - A note with no customer: it should ask "Who bought it?"; answer with just the name.
   - A question while a note is waiting: it should remind you.
   - Tell BizBuddy: the missing-detail hint, the reminder banner, and the auto-save switch in Settings.
2. **Commit and push** the uncommitted work listed above.
3. **Switch the scheduler to every minute:** run the `cron.schedule` line under Current setup → Supabase.
4. **Submit the templates** in the table above. If Meta rejects one, adjust the wording and keep the same name and blanks.
5. **When `bizbuddy_welcome` is approved:** set `WHATSAPP_WELCOME_TEMPLATE=bizbuddy_welcome` in `.env`, or delete the line, since that is the default. Then restart and sign up a fresh account to check it.
6. **Deploy to Vercel.**
   - Put in every variable from `.env` (including `CRON_SECRET`), and set `NEXT_PUBLIC_APP_URL`.
   - Point the scheduler at Vercel: `vault.update_secret` on `bizbuddy_remind_url` (decision 32).
   - Pick the region nearest the Supabase project.
   - Move Meta's webhook from ngrok to `https://<vercel app>/api/whatsapp`.
7. **Move to the real number** (+254 706 931455).
   - Get its WABA ID, then `POST /<WABA_ID>/subscribed_apps`.
   - Create `bizbuddy_welcome` again on that WABA and wait for approval.
   - Set `WHATSAPP_PHONE_NUMBER_ID=1361836510344909`.
   - `hello_world` will not work there.
   - The "To" list limit goes away, so any owner can sign up and get messages.
8. **Business verification** in Meta Business Manager, to lift the messaging limits and show BizBuddy's name.
9. **Put it in front of real shop owners** (`BIZBUDDY_PLAN.md` §38). Give it to a few Nigerian shop owners, watch them record a real day in the app and on WhatsApp, and write down every problem. Let that decide what comes next.
10. **Later:**
   - Password reset.
   - A way to change the account's phone number.

## Figma Make export: known bugs (don't port these)

- `font-500`/`font-600`/`font-700`/`font-800` classes do nothing in Tailwind v4, so all text renders at normal weight.
- Sale balances ignore later payments, so a sale and its customer show different amounts owed.
- "Collected" includes a payment whenever that customer had *any* sale in the period, whatever the payment's own date.
- "Load demo data" in Settings overwrites real data without confirmation.
- The dashboard Ask input and suggestion chips throw away the question.
- The mobile **+** goes straight to Record Sale instead of opening the quick-action menu.
- Dates use `toISOString()` (UTC).
- KPI cards are clickable `div`s, and labels aren't linked to inputs.
- Toast animation classes need a plugin that isn't installed.

## Open questions for the product owner

- **Font:** Outfit (from the Figma design) or Inter (from the UX doc)?
- **Expenses on mobile:** keep it off the bottom bar, or replace one of the tabs?
- **Data model:** should `BIZBUDDY_PLAN.md` §17 be updated to the payments-only model?
