import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PitchView } from "@/components/pitch/PitchView";
import { PitchViewBeacon } from "@/components/pitch/PitchViewBeacon";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import { demoPitch } from "@/lib/outreach/demo";
import { outreachByToken } from "@/lib/outreach/store";
import { getServiceSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// The link is the key: no search engine, and no referrer to the store's
// photos or anywhere else.
export const metadata: Metadata = {
  title: "Your sample campaign · Walkoff",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function PitchPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // walkoff.io/p/demo: the page a prospect gets, for the sample brand.
  if (token === "demo") {
    return (
      <>
        <SiteNav />
        <main className="upload-page">
          <PitchView page={demoPitch()} demo />
        </main>
        <SiteFooter />
      </>
    );
  }

  let pitch;
  try {
    pitch = await outreachByToken(getServiceSupabase(), token);
  } catch {
    notFound();
  }
  if (!pitch) notFound();

  return (
    <>
      <SiteNav />
      <main className="upload-page">
        <PitchView
          page={pitch.campaign}
          source={{ utm_source: "outreach", utm_medium: "email", utm_campaign: pitch.team_key, utm_content: pitch.id }}
        />
        <PitchViewBeacon token={token} />
      </main>
      <SiteFooter />
    </>
  );
}
