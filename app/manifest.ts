import type { MetadataRoute } from "next";

// Lets shop owners add BizBuddy to their home screen. It opens straight into the books;
// the app shell sends anyone without a shop to /welcome.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BizBuddy",
    short_name: "BizBuddy",
    description: "Record sales, part payments, and expenses. See who still owes you.",
    id: "/dashboard",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fafaf8",
    theme_color: "#15803d",
    categories: ["business", "finance", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
