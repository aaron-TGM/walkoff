import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";

/** /onboarding and /help: help pages inside the site's nav and footer. */
export default function GuideLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteNav />
      <main className="help-page">{children}</main>
      <SiteFooter />
    </>
  );
}
