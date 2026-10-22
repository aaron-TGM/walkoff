import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import { UploadClient } from "@/components/upload/UploadClient";
import { computeAffinity } from "@/lib/affinity/compute";
import { DEMO_BRAND, demoData } from "@/lib/affinity/demo";
import { brandByToken, catalogStats, latestReport } from "@/lib/affinity/store";
import { getServiceSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your affinity map · Walkoff",
  robots: { index: false, follow: false },
};

export default async function UploadPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // walkoff.io/upload/demo: a sample brand, and files never leave the browser.
  if (token === "demo") {
    const seed = demoData();
    const report = computeAffinity(seed.areas, { products: seed.products, catalog: seed.catalog });
    return (
      <>
        <SiteNav />
        <main className="upload-page">
          <UploadClient
            token="demo"
            brandName={DEMO_BRAND}
            initialReport={report}
            initialCatalog={{ products: seed.catalog.length, tagged: seed.catalog.length }}
            demo
          />
        </main>
        <SiteFooter />
      </>
    );
  }

  let db;
  try {
    db = getServiceSupabase();
  } catch {
    notFound();
  }
  const brand = await brandByToken(db, token);
  if (!brand) notFound();
  const [report, catalog] = await Promise.all([latestReport(db, brand.id), catalogStats(db, brand.id)]);

  return (
    <>
      <SiteNav />
      <main className="upload-page">
        <UploadClient token={token} brandName={brand.name} initialReport={report} initialCatalog={catalog} />
      </main>
      <SiteFooter />
    </>
  );
}
