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

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  return {
    title: token === "demo" ? "A sample fan map · Walkoff" : "Your affinity map · Walkoff",
    robots: { index: false, follow: false },
  };
}

export default async function UploadPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // walkoff.io/upload/demo: a sample brand's map, no file needed. A file
  // tried there is read in the browser and never leaves it.
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
            initialCatalog={{
              products: seed.catalog.length,
              tagged: 0,
              colorways: seed.catalog.reduce((n, p) => n + (p.colorways?.length ?? 0), 0),
            }}
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
