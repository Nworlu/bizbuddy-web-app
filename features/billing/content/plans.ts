// What a subscription is, before anyone can pay. Books stay free.
// Shop and Counter are not on yet. Counter is the plan to pick: it is the higher one, and it is marked recommended.

export const BOOKS = {
  name: "Books",
  amount: 0,
  price: "₦0",
  cadence: "",
  summary: "The website stays free. Record the shop with no subscription.",
  points: ["Sales, payments, expenses, and customers", "The day on the dashboard", "Add it to your home screen, then it opens with no internet", "Backed up when you have an account"],
  comingSoon: false,
  recommended: false,
} as const;

export const SHOP = {
  name: "Shop",
  amount: 8000,
  price: "₦8,000",
  cadence: "a month",
  summary: "Write the day on WhatsApp, and get told when someone still owes you.",
  points: ["Write the sale on WhatsApp", "Reminders to collect what you're owed", "Tell BizBuddy after the 15 test messages"],
  comingSoon: true,
  recommended: false,
} as const;

export const COUNTER = {
  name: "Counter",
  amount: 15000,
  price: "₦15,000",
  cadence: "a month",
  summary: "The whole shop, not only the notes. This is the one to pick.",
  points: ["Everything in Shop", "Voice notes", "The evening check-in and the Sunday summary", "Learn the shop from a photo, your website, or your socials"],
  comingSoon: true,
  recommended: true,
} as const;

export const PLANS = [BOOKS, SHOP, COUNTER] as const;

export const BILLING_LATER = [
  { title: "Payment method", body: "A card or transfer will go here. Nothing is saved, and nothing is charged." },
  { title: "Invoices", body: "A receipt for each month will show here." },
  { title: "Next charge", body: "There is no date. Shop and Counter are not on yet, so nothing is billed." },
] as const;
