import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Walkoff · Every moment is a marketing moment.",
  description:
    "Walkoff finds the real-world moments your customers care about, starting with sports, matches your products, and fires your message while the moment is still hot. Plugs into Claude and any AI agent through MCP.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://walkoff.io",
  ),
  openGraph: {
    title: "Walkoff · Every moment is a marketing moment.",
    description:
      "The moment engine for brands and their AI agents. Sports first, then weather, events and culture.",
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
