import type { Metadata } from "next";
import { SiteAnalytics } from "@/components/SiteAnalytics";
import { SITE_URL } from "@/lib/connect";
import { PRICING } from "@/lib/pricing";

import "./globals.css";

const TITLE = "Walkoff · Sports moments, ready as Klaviyo campaigns";
const DESCRIPTION = `When their team wins, Walkoff builds your Klaviyo campaign: your own products in the team's colors, for customers in its territory. In Claude. ${PRICING.trialDays} days free.`;

// The share image is app/opengraph-image.png.
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  // Canonical and share links: walkoff.io redirects here.
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/",
    siteName: "Walkoff",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans text-base">
        {children}
        <SiteAnalytics />
      </body>
    </html>
  );
}
