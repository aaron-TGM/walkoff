import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/connect";

/** Upload links, sign-in and the MCP endpoint aren't pages to index. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/upload/", "/oauth/", "/api/", "/mcp"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
