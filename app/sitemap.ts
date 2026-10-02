import type { MetadataRoute } from "next";
import { siteUrl } from "@/shared/lib/site";

const PAGES = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const lastModified = new Date("2026-10-02");
  return PAGES.map((page) => ({
    url: new URL(page.path, base).toString(),
    lastModified,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}
