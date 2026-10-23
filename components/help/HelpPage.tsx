import Link from "next/link";
import { Eyebrow } from "@/components/Eyebrow";
import { HELP_PAGES, helpPage, type HelpSectionId, type HelpSlug } from "@/lib/help/pages";

function PageLinks({ current }: { current: HelpSlug }) {
  return (
    <ul>
      {HELP_PAGES.map((p) => (
        <li key={p.slug}>
          <Link href={p.path} aria-current={p.slug === current ? "page" : undefined}>
            {p.nav}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** A help page: every page in the sidebar (a list on phones), the title,
 *  what's on the page, the article, and the pages either side. */
export function HelpPage({ slug, children }: { slug: HelpSlug; children: React.ReactNode }) {
  const page = helpPage(slug);
  const i = HELP_PAGES.findIndex((p) => p.slug === slug);
  const prev = HELP_PAGES[i - 1];
  const next = HELP_PAGES[i + 1];
  return (
    <div className="help-grid">
      <nav className="help-side" aria-label="Help pages">
        <div className="help-side-inner">
          <div className="help-side-title">Help center</div>
          <PageLinks current={slug} />
        </div>
      </nav>
      <article className="help-article">
        <details className="help-pages">
          <summary>All help pages</summary>
          <PageLinks current={slug} />
        </details>
        <Eyebrow>{slug === "onboarding" ? "Onboarding" : "Help center"}</Eyebrow>
        <h1 className="help-h1">{page.title}</h1>
        <p className="help-lead">{page.description}</p>
        <nav className="help-toc" aria-label="On this page">
          <div className="help-toc-title">On this page</div>
          <ol>
            {page.sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.title}</a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="help-prose">{children}</div>
        <nav className="help-nextprev" aria-label="More help">
          {prev ? (
            <Link href={prev.path} className="help-prev">
              <span>Previous</span>
              {prev.nav}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link href={next.path} className="help-next">
              <span>Next</span>
              {next.nav}
            </Link>
          ) : null}
        </nav>
      </article>
    </div>
  );
}

/** A section whose id and title come from the page registry, so the
 *  contents list and the headings always agree. */
export function HelpSection<S extends HelpSlug>({ page, id, children }: { page: S; id: HelpSectionId<S>; children: React.ReactNode }) {
  const title = helpPage(page).sections.find((s) => s.id === id)?.title;
  return (
    <section id={id} className="help-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
