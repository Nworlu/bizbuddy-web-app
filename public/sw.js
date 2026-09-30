// BizBuddy service worker: lets the app open and work with no internet.
//
// Records never pass through here. They live in the browser's localStorage (shared/lib/store.ts),
// so recording works offline already. This file only makes sure the pages themselves load.
//
// - Install: save every page, plus the scripts and styles each page uses.
// - Pages: network first, so an online user always gets the latest version. On a slow
//   connection, give up after NETWORK_TIMEOUT_MS and use the saved copy.
// - /_next/static/*: file names contain a content hash, so a saved copy is always right.
// - Everything else from this site (icons, manifest): use the saved copy, refresh it in the background.
//
// Bump VERSION when this file's caching rules change, to clear the old caches.

const VERSION = "v1";
const PAGES = `bizbuddy-pages-${VERSION}`;
const ASSETS = `bizbuddy-assets-${VERSION}`;
const NETWORK_TIMEOUT_MS = 3000;

// Every route is static; record pages read their id from ?id= (shared/lib/routes.ts).
const APP_PAGES = [
  "/",
  "/welcome",
  "/dashboard",
  "/sales",
  "/sales/new",
  "/sales/view",
  "/sales/edit",
  "/customers",
  "/customers/new",
  "/customers/view",
  "/customers/edit",
  "/expenses",
  "/expenses/new",
  "/expenses/edit",
  "/ask",
  "/settings",
  "/privacy",
  "/terms",
];
const OTHER_FILES = ["/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/icon-maskable-512.png", "/apple-icon.png"];

/** Scripts, styles and fonts a page's HTML refers to, so the page still works when opened offline. */
function assetsIn(html) {
  const found = new Set();
  for (const match of html.matchAll(/\/_next\/static\/[^"'\s)\\]+/g)) found.add(match[0]);
  return [...found];
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const pages = await caches.open(PAGES);
      const assets = await caches.open(ASSETS);
      const needed = new Set();
      await Promise.all(
        APP_PAGES.map(async (path) => {
          const response = await fetch(path, { cache: "no-store" });
          if (!response.ok) return;
          const html = await response.clone().text();
          assetsIn(html).forEach((url) => needed.add(url));
          await pages.put(path, response);
        }),
      );
      await Promise.all([...needed].map((url) => assets.add(url).catch(() => undefined)));
      await Promise.all(OTHER_FILES.map((url) => assets.add(url).catch(() => undefined)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([PAGES, ASSETS]);
      for (const name of await caches.keys()) {
        if (name.startsWith("bizbuddy-") && !keep.has(name)) await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(page(request, url));
    return;
  }
  // In-app navigation data (React Server Components). Leave it to the network: if it fails,
  // Next.js falls back to a full page load, which the page handler above answers offline.
  if (request.headers.get("RSC") === "1" || url.searchParams.has("_rsc")) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }
  event.respondWith(staleWhileRevalidate(request));
});

/** Network first with a timeout; saved copy (ignoring ?id=… and other query strings) when offline or slow. */
async function page(request, url) {
  const cache = await caches.open(PAGES);
  const network = fetch(request).then(async (response) => {
    if (response.ok && response.type === "basic") {
      await cache.put(url.pathname, response.clone());
      const assets = await caches.open(ASSETS);
      const html = await response.clone().text();
      await Promise.all(assetsIn(html).map((asset) => assets.match(asset).then((hit) => hit || assets.add(asset).catch(() => undefined))));
    }
    return response;
  });
  // If the saved copy is served first, a later network failure must not surface as an unhandled rejection.
  network.catch(() => undefined);
  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), NETWORK_TIMEOUT_MS));

  try {
    const fast = await Promise.race([network, timeout]);
    if (fast) return fast;
  } catch {
    // Offline: fall through to the saved copy.
  }
  const saved = await cache.match(url.pathname, { ignoreSearch: true });
  if (saved) return saved;
  try {
    return await network; // Slow, but there's no saved copy: keep waiting.
  } catch {
    // Nothing saved for this path (e.g. a mistyped address): open the books instead.
    return (await cache.match("/dashboard")) || (await cache.match("/")) || Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSETS);
  const saved = await cache.match(request);
  if (saved) return saved;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(ASSETS);
  const saved = await cache.match(request);
  const refresh = fetch(request)
    .then(async (response) => {
      if (response.ok) await cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  return saved || (await refresh) || Response.error();
}
