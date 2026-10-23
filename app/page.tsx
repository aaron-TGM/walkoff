import type { Metadata } from "next";
import { MarketingPage } from "@/components/MarketingPage";

// Here, not in the layout: every other page would inherit it.
export const metadata: Metadata = { alternates: { canonical: "/" } };

export default function Home() {
  return <MarketingPage />;
}
