// The tool reference, the troubleshooting list and the guide cards, from
// the help center's data (lib/help).
import Link from "next/link";
import { HELP_PAGES } from "@/lib/help/pages";
import { HELP_TOOLS, type HelpTool } from "@/lib/help/tools";
import type { Trouble } from "@/lib/help/troubleshooting";

export function ToolReference() {
  return (Object.entries(HELP_TOOLS) as [string, HelpTool][]).map(([name, t]) => (
    <div key={name} id={`tool-${name}`} className="help-tool">
      <h3>
        <code>{name}</code>{" "}
        {t.changes ? (
          <span className="help-badge help-badge-change">Saves changes</span>
        ) : (
          <span className="help-badge help-badge-read">Read only</span>
        )}
      </h3>
      <p>{t.summary}</p>
      {t.options ? (
        <ul>
          {Object.entries(t.options).map(([opt, what]) => (
            <li key={opt}>
              <code>{opt}</code>: {what}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  ));
}

export function TroubleList({ items }: { items: Trouble[] }) {
  return (
    <div className="help-faq">
      {items.map((t) => (
        <div key={t.id} id={t.id} className="help-faq-item">
          <h3>&ldquo;{t.says}&rdquo;</h3>
          <div className="help-faq-a">
            <p>{t.fix}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/** A card for each guide. */
export function GuideCards() {
  return (
    <ul className="help-cards">
      {HELP_PAGES.filter((p) => p.slug !== "help").map((p) => (
        <li key={p.slug}>
          <Link href={p.path} className="help-card">
            <div className="help-card-title">{p.nav}</div>
            <div className="help-card-body">{p.description}</div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
