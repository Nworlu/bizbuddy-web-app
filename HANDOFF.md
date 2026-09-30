# BizBuddy: Handoff

_Last updated: 29 Sep 2026_

## Where things stand

The V0.1 web app is in `bizbuddy-web-app/`. **Done:** the public landing page, onboarding, the app shell, the dashboard, Record Sale, the Sales list, Sale Details with Record Payment, Customers (list, customer page with Record Payment, Add Customer), Expenses (list with period filter and category totals, Record Expense), Ask BizBuddy, Settings (edit business details, record counts, sample shop, delete everything), editing or deleting sales, payments, expenses, and customers, the polish from the review, a Custom date range, an offline banner, and a PWA that installs on the home screen and opens with no internet. Every V0.1 screen and spec item is built.

The next task is **putting it in front of real shop owners**, and deciding on **accounts and a server**. See Next steps. The build order comes from `BizBuddy_Web_App.md` §50. Onboarding was built earlier than that list because the landing page needed a setup flow.

GitHub: https://github.com/Nworlu/bizbuddy-web-app (`origin`, branch `main`). The app commit for the landing page, setup, and Record Sale is `afec612`. This file is the handoff. A copy is committed at `bizbuddy-web-app/HANDOFF.md` so GitHub stays current. After each feature, update this file, copy it into the app, and commit the app code.

WhatsApp is the long-term assistant (plain-language sale, expense, payment, and questions). It is Phase 3 in `BIZBUDDY_PLAN.md`. Do not build it until the web book is usable.

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

Records still live in this browser. Closing the tab keeps them. Another phone, another browser, or cleared site data starts empty. There is no server yet.

## Stack

- **Next.js 16.3.6** (App Router, Turbopack), React 19.2, Tailwind v4, TypeScript.
- **Next 16 has breaking changes.** Per `AGENTS.md`, read `node_modules/next/dist/docs/` before using a Next API. For example, `params` is a Promise, and `LayoutProps<"/">` is a global type.
- **Font:** Outfit, via `next/font/google`. It comes from the Figma design; the UX doc suggests Inter.

## Code map

Routes in `app/` are thin. A route imports a screen; the screen owns its UI.

```
app/
  page.tsx                     public landing page
  welcome/page.tsx             onboarding (welcome, name + phone, business); demo via ?demo=1
  privacy/page.tsx, terms/page.tsx
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
  (app)/ask/page.tsx           Tell BizBuddy chat; reads ?q= from the dashboard (Suspense for useSearchParams)
  api/tell/route.ts            POST: the AI reads a note (signed-in users only)
  (app)/settings/page.tsx      Settings: account (back up / status / log out), business details, record counts, sample shop, delete everything
  login/page.tsx               log in with phone + password

features/
  marketing/                   landing screen, FAQ, legal shell
  onboarding/                  welcome screen
  shell/                       app shell, useBiz()
  dashboard/                   dashboard screen
  sales/                       sales list, Record Sale, sale details, edit sale
  customers/                   customers list, customer page, add and edit customer, CustomerAvatar
  expenses/                    expenses list, Record Expense
  ask/                         lib/answer.ts: answers from the books (keyword matcher + answerTopic)
  tell/                        Tell BizBuddy: screen, draft cards, lib/intents.ts (schema, toDraft), lib/client.ts, server/interpret.ts (OpenAI or Claude call)
  settings/                    settings screen, account section
  account/                     login screen

shared/
  ui/                          logo, icons, period-filter (with usePeriodRange), confirm-dialog, delete-payment-button, offline-banner  (used by more than one feature)
  lib/
    types.ts                   data model
    phone.ts                   Nigerian phone numbers -> 234XXXXXXXXXX -> private login name
    sync.ts                    offline-first sync: outbox, diff, row mapping, merge, syncOnce() (no Supabase code)
    supabase.ts                Supabase client + the RemoteApi syncOnce() uses; null without env keys
    account.ts                 createAccount(), logIn(), logOut()
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
18. **Offline.** `<OfflineBanner>` in the app shell shows while `navigator.onLine` is false. It says BizBuddy still works and records are saved on this phone. It must never say anything was synced: there is no server.
19. **BizBuddy is a PWA and every page is static.** Record pages take the id from the query string (`/sales/view?id=…`, built by `shared/lib/routes.ts`), never the path: a `/sales/[id]` page is built per id on the server, so a sale recorded offline could not be opened. Don't add dynamic `[param]` routes or read `searchParams` in a page's server component; read `?id=` with `useSearchParams` in a client "Route" component inside `<Suspense>`. `npm run build` should list every route as ○ (Static).
20. **The service worker** is `public/sw.js`, registered by `shared/ui/service-worker.tsx` in production only. On install it saves every page listed in `APP_PAGES` plus the scripts and styles each uses. Pages are network-first with a 3-second timeout, then the saved copy (ignoring the query string); `/_next/static` is cache-first; business records are never cached here. **When you add a page, add it to `APP_PAGES`.** Bump `VERSION` when the caching rules change. To test offline: `npm run build && npx next start -p 3200`, open it, wait for the service worker, then stop the server and keep using the app. The service worker doesn't run under `npm run dev`.
21. **Accounts and sync.** Supabase, phone number + password. Supabase's own phone login needs a paid SMS code, so `shared/lib/phone.ts` turns 0803 123 4567 into the private login `2348031234567@users.bizbuddy.app`. Nothing is ever emailed; **email confirmation must be off** in Supabase.
   - The books stay in localStorage first, so everything works offline. Linked to an account, every change is also queued in an outbox. The books and the outbox are saved in **one** localStorage entry, so neither can be saved without the other.
   - `syncOnce()` sends the outbox, then pulls rows the server changed since the last pull (with a 60-second overlap). A change still in the outbox beats the pulled copy. The server's `updated_at` decides what's new, never the phone's clock. Deletes are sent as `deleted = true`.
   - Record ids are made on the phone; on the server the key is `(business_id, id)`. Row level security lets each user reach only their own shop (tested on Postgres in `supabase/migrations/0001_bizbuddy.sql`'s rules).
   - The sample shop is never sent. It can't be opened while signed in, and "Delete everything" is hidden while signed in (log out instead). Logging in refuses to replace books that aren't in an account. Logging out removes the books from the phone and warns if changes haven't reached the account.
   - The UI never says "Backed up" until the server has confirmed (UX spec §28). Status shows in the sidebar and mobile header (`SyncBadge`).
   - Without `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (see `.env.example`), accounts switch off and the app works on the phone only, as before.
   - **Setup:** create a Supabase project; run `supabase/migrations/0001_bizbuddy.sql` in its SQL editor; Authentication → Email → turn off "Confirm email"; put the project URL and publishable key in `.env.local` (and in Vercel's environment variables). Never use the service_role key in the app.
   - Password reset isn't built: "Forgot your password?" says to contact BizBuddy. Resetting means changing it in the Supabase dashboard (Authentication → Users).
22. **Tell BizBuddy** (`/ask`, `features/tell/`). The owner types a note ("Sold 2 shoes to David for 85k, he paid 50k"); `POST /api/tell` sends it to an AI model and gets back actions: sale, expense, payment, question, or unclear. **Provider:** OpenAI when `OPENAI_API_KEY` is set (`OPENAI_MODEL`, default `gpt-5.4-mini`, low reasoning effort, strict JSON schema); otherwise Claude when `ANTHROPIC_API_KEY` is set (`claude-opus-5-5`, low effort, structured output, refusal fallback). Both get the same instructions and schema (`features/tell/server/interpret.ts`).
   - **The AI only reads; the app decides.** It never sees the books, only the note, today's date, and customer names (to match "David" to "David Okafor"). It never calculates: a unit price and quantity come back as said, and `toDraft()` works out the total. Questions come back as a topic and `answerTopic()` answers from `finance.ts`.
   - Every sale, expense, or payment is shown as an editable **draft card**; nothing is saved until Save, which uses the normal store functions and rules.
   - Needs a signed-in account (the route checks the Supabase access token, so strangers can't spend the AI key) and a connection. Offline or without an account, the screen falls back to the keyword question matcher (`answerQuestion()`).
   - The API keys are server-only (`.env` locally, Vercel env in production; never `NEXT_PUBLIC_`). The route rate-limits to 30 notes per user per 10 minutes per server instance.
   - The same reader is meant to power WhatsApp next: a webhook that calls `interpret()` and replies with the draft for a YES.
   - **Who the chat is with.** WhatsApp only shows the person messaging BizBuddy, not the owner's other chats. Their number is matched to the shop owner (`business_for_login`) or to one customer whose phone is saved (`customers_for_whatsapp` in `supabase/migrations/0002_whatsapp.sql`). A customer's chat speaks to them by name, says what they owe that shop, and treats "I paid 20k" as their payment. An owner's chat stays on the last customer they named (`whatsapp_focus`) until they name someone else. `features/whatsapp/lib/person.ts` does that; `whoIsChatting()` loads it. The owner's number wins if the same phone is also saved as a customer.

## Styling rules

- The color tokens are in `app/globals.css` (`brand-*`, `surface`, `ink`, `ink-muted`).
- **Use `brand-700` and `amber-700` for text and buttons.** `brand-600` and `amber-600` fail WCAG AA contrast on white; use them for fills and accents only.
- Use Tailwind's named weights (`font-medium`, `font-semibold`, `font-bold`). **`font-600` and similar don't exist in Tailwind v4 and silently compile to nothing.** That's why the Figma export renders everything at normal weight.
- **Mobile grids need an explicit `grid-cols-1`.** An implicit column grows to fit long `truncate` text and causes sideways scroll. The dashboard is verified with no sideways scroll at 320px and 390px wide.
- **Accessibility:** use `<Link>` or `<button>` for anything clickable, never a clickable `div`. Link every `<label>` to its input with `htmlFor`, and use `aria-invalid` and `aria-describedby` for errors. Show paid versus owing with text, not color alone.

## Next steps

V0.1 is built: every screen in `BizBuddy_Web_App.md` §49 exists, mistakes can be fixed, and the tests cover the money rules.

1. **Put it in front of real shop owners** (`BIZBUDDY_PLAN.md` §38): deploy it, give it to a few Nigerian shop owners, watch them record a real day, and write down every problem. Let that decide what comes next.
2. **Accounts and a server** before shop owners rely on it day to day. Records live in one browser today, so a new phone or cleared site data loses them. Needs decisions (see open questions). Only `shared/lib/store.ts` should need to change underneath the screens.
3. **Sync, with the server.** The app already works offline. When records move to a server, keep them on the phone first, queue each change, and send the queue when the connection returns; show "saved on this phone" until the server confirms (UX spec §28).
4. **Later:** WhatsApp (Phase 3 in the plan).

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

- **Storage and auth:** Sales must still be there on another phone. Onboarding collects a name and phone and saves them in this browser only. A real account needs a server. None is set up. WhatsApp comes after the web book, not before it.
- **Font:** Outfit (from the Figma design) or Inter (from the UX doc)?
- **Expenses on mobile:** keep it off the bottom bar, or replace one of the tabs?
- **Data model:** should `BIZBUDDY_PLAN.md` §17 be updated to the payments-only model?
