import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";

import "./globals.css";

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Walkoff — Every sports moment is a marketing moment.",
  description:
    "Walkoff connects your Klaviyo to the full sports calendar. Rivalry previews, in-game alerts, win triggers, season milestones — every moment your customer cares about, turned into a timely email.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://walkoff.io",
  ),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={jetbrains.variable}>
      <body className="font-sans text-base">{children}</body>
    </html>
  );
}
