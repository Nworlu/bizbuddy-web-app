import type { MetadataRoute } from "next";
import { siteUrl } from "@/shared/lib/site";

const PRIVATE = ["/dashboard", "/sales", "/expenses", "/customers", "/settings", "/billing", "/ask", "/admin", "/welcome", "/login", "/api"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: PRIVATE },
    sitemap: new URL("/sitemap.xml", siteUrl()).toString(),
  };
}
