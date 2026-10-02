/** Public site copy and address. Used by the page titles, the sitemap, and link previews. */
export const SITE_NAME = "BizBuddy";
export const SITE_TITLE = "BizBuddy — run the shop from one book";
export const SITE_DESCRIPTION =
  "A book for Nigerian shops. Record what you sold, what came in, and what you spent. Cash, transfer, and POS. It works on your phone with no internet.";

const FALLBACK_ORIGIN = "https://bizbuddy-web-app.vercel.app";

function isPublicSite(url: URL): boolean {
  const host = url.hostname;
  if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".local")) return false;
  // A tunnel is for WhatsApp testing. Search results should point at the public app.
  if (host.includes("ngrok")) return false;
  return url.protocol === "https:" || url.protocol === "http:";
}

/** Absolute site address. Prefers NEXT_PUBLIC_APP_URL so a custom domain wins once it is set. */
export function siteUrl(): URL {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (raw) {
    try {
      const url = new URL(raw);
      if (isPublicSite(url)) return url;
    } catch {
      // Ignore a bad value and use the live app address.
    }
  }
  return new URL(FALLBACK_ORIGIN);
}
