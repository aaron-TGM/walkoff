import { Eyebrow } from "@/components/Eyebrow";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";

export function LegalPage({
  eyebrow,
  title,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteNav />
      <main className="legal-page">
        <div className="container-narrow">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="legal-h1">{title}</h1>
          <p className="legal-updated">Last updated {updated}</p>
          <article className="legal">{children}</article>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
