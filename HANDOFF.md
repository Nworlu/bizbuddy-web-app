# BizBuddy: Handoff

_Last updated: 29 Sep 2026_

## Where things stand

The V0.1 web app is in `bizbuddy-web-app/`. **Done:** the public landing page, onboarding, the app shell, the dashboard, Record Sale, the Sales list, Sale Details with Record Payment, and Customers (list, customer page with Record Payment, Add Customer). Expenses, Ask BizBuddy, and settings are still placeholders.

The next task is **Expenses**: Record Expense (`/expenses/new`) and the Expenses list (`/expenses`). The build order comes from `BizBuddy_Web_App.md` §50. Onboarding was built earlier than that list because the landing page needed a setup flow.

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
./node_modules/.bin/tsc --noEmit && npm run lint && npm run build
```

Use the project's TypeScript binary. `npx tsc` can install an unrelated package.

There is no test runner yet. The money calculations were checked with a throwaway `tsx` script against the demo data.

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
  (app)/sales/new/page.tsx     Record Sale
  (app)/sales/[id]/page.tsx    sale details and record payment
  (app)/customers/page.tsx     customers list, who owes what
  (app)/customers/[id]/page.tsx  customer page: totals, history, record payment (oldest sale first)
  (app)/customers/new/page.tsx add customer
  (app)/{expenses,ask,settings}/…   ComingSoon

features/
  marketing/                   landing screen, FAQ, legal shell
  onboarding/                  welcome screen
  shell/                       app shell, useBiz()
  dashboard/                   dashboard screen
  sales/                       sales list, Record Sale, sale details
  customers/                   customers list, customer page, add customer, CustomerAvatar
  expenses, ask, settings/     screen placeholders only

shared/
  ui/                          logo, icons, coming-soon  (used by more than one feature)
  lib/
    types.ts                   data model
    store.ts                   localStorage store + useBizData() + createBusiness() + recordSale() + recordPayment() + addCustomer() + recordCustomerPayment()
    toast.ts                   showToast(); the shell listens and shows it
    finance.ts                 ALL money calculations (pure functions)
    dates.ts                   local-date helpers, period ranges
    format.ts                  formatNaira, formatDate, greeting
    demo.ts                    Ada's Fashion sample data, dated relative to today
```

A feature holds `screen/`, and `components/`, `hooks/`, `types/`, or `content/` only when that feature has something to put there. Do not add empty folders. `shared/ui` is for UI used by more than one feature. `shared/lib` is cross-feature logic, not UI.

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
14. **Customer names are unique, ignoring case and extra spaces** (`findCustomerByName()`). Record Sale reuses the existing customer; Add Customer refuses a duplicate and links to the existing one.

## Styling rules

- The color tokens are in `app/globals.css` (`brand-*`, `surface`, `ink`, `ink-muted`).
- **Use `brand-700` and `amber-700` for text and buttons.** `brand-600` and `amber-600` fail WCAG AA contrast on white; use them for fills and accents only.
- Use Tailwind's named weights (`font-medium`, `font-semibold`, `font-bold`). **`font-600` and similar don't exist in Tailwind v4 and silently compile to nothing.** That's why the Figma export renders everything at normal weight.
- **Mobile grids need an explicit `grid-cols-1`.** An implicit column grows to fit long `truncate` text and causes sideways scroll. The dashboard is verified with no sideways scroll at 320px and 390px wide.
- **Accessibility:** use `<Link>` or `<button>` for anything clickable, never a clickable `div`. Link every `<label>` to its input with `htmlFor`, and use `aria-invalid` and `aria-describedby` for errors. Show paid versus owing with text, not color alone.

## Next steps

1. **Record Expense and the Expenses list.** `EXPENSE_CATEGORIES` and the `Expense` type already exist; add `recordExpense()` to the store with the whole-naira check. The dashboard Expenses card and Recent Activity already read expenses.
2. **Ask BizBuddy.** The dashboard already sends `/ask?q=…`. Port the keyword matcher from the Figma `AskBizBuddy.tsx`, but build every answer from `finance.ts`.
3. **Settings.** Show business info. "Load demo data" must **confirm before replacing existing records** (use `hasRecords()`). Add "Reset all data" with a confirmation.
4. **Remaining work from the spec:**
   - "Record a sale" on a customer page doesn't pre-fill the customer yet
   - editing a customer's name or phone
   - the Custom date range
   - an offline banner
   - edit and delete for sales, with confirmation (§27)
   - a test runner for `finance.ts` and `dates.ts` (Vitest is the obvious choice)

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
