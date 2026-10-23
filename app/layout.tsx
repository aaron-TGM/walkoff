import type { Metadata } from "next";
import { SITE_URL } from "@/lib/connect";

import "./globals.css";

export const metadata: Metadata = {
  title: "Walkoff · The moment engine for brands and their AI agents",
  description:
    "Walkoff finds the real-world moments your customers care about, starting with sports, matches your products, and has your campaign ready while the moment is still hot. Plugs into Claude and any AI agent through MCP.",
  // Canonical and share links: walkoff.io redirects here.
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: "Walkoff · The moment engine for brands and their AI agents",
    description:
      "Sports moments matched to your customers and your products, ready as campaigns in Claude. Weather, events and culture next.",
    url: "/",
    siteName: "Walkoff",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans text-base">{children}</body>
    </html>
  );
}
