import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/connect";
import { HELP_PAGES } from "@/lib/help/pages";

/** The public pages, help center included (from its page list). */
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ["/", ...HELP_PAGES.map((p) => p.path), "/status", "/privacy", "/terms"];
  return paths.map((path) => ({ url: path === "/" ? SITE_URL : `${SITE_URL}${path}` }));
}
