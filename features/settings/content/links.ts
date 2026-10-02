export type SettingsLink = { href: string; label: string; detail: string };

/** The settings pages. Hidden ones depend on whether this shop has an account. */
export function settingsLinks(state: { accounts: boolean; signedIn: boolean; demo: boolean }): SettingsLink[] {
  const shop = state.accounts && state.signedIn && !state.demo;
  return [
    state.accounts && !state.demo ? { href: "/settings/account", label: "Account", detail: "Back up, log out, or delete the account." } : null,
    { href: "/settings/business", label: "Business", detail: "Name, phone, and what the shop does." },
    shop ? { href: "/settings/reminders", label: "Reminders", detail: "When BizBuddy nudges you." } : null,
    shop ? { href: "/settings/shop", label: "Your shop", detail: "What BizBuddy has learned, and your pages." } : null,
    { href: "/settings/records", label: "Records", detail: "How many sales, payments, and customers are saved." },
    { href: "/settings/chat", label: "Chat", detail: "The conversation BizBuddy keeps. You can clear it." },
    !state.signedIn ? { href: "/settings/start", label: "Start over", detail: "Open the sample shop, or delete this shop from the phone." } : null,
  ].filter((link): link is SettingsLink => link !== null);
}
