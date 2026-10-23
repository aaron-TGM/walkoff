// The building blocks of help pages. All server-rendered, so every answer is
// in the page's HTML; only the copy button runs in the browser.
import type { SessionLine } from "@/lib/help/sessions";
import { CopyButton } from "./CopyButton";

/** Steps in order, each marked with who does it. */
export function Steps({ children }: { children: React.ReactNode }) {
  return <ol className="help-steps">{children}</ol>;
}

export function Step({ who, title, children }: { who: "you" | "walkoff"; title: string; children: React.ReactNode }) {
  return (
    <li className="help-step">
      <div className="help-step-head">
        <span className="help-step-title">{title}</span>
        <span className={`help-who help-who-${who}`}>{who === "you" ? "You" : "Walkoff"}</span>
      </div>
      <div className="help-step-body">{children}</div>
    </li>
  );
}

export function Callout({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <aside className="help-callout">
      {title ? <div className="help-callout-title">{title}</div> : null}
      {children}
    </aside>
  );
}

/** Something to ask Claude, ready to copy. */
export function Ask({ children }: { children: string }) {
  return (
    <div className="help-ask">
      <span className="help-ask-label">Ask Claude</span>
      <q className="help-ask-text">{children}</q>
      <CopyButton text={children} />
    </div>
  );
}

/** Text to copy as is, like the connector address. */
export function CopyLine({ children }: { children: string }) {
  return (
    <div className="help-copyline">
      <code>{children}</code>
      <CopyButton text={children} />
    </div>
  );
}

/** Questions with their answers showing, each linkable by its id. */
export function HelpFaq({ items }: { items: { id: string; q: string; a: React.ReactNode }[] }) {
  return (
    <div className="help-faq">
      {items.map((it) => (
        <div key={it.id} id={it.id} className="help-faq-item">
          <h3>{it.q}</h3>
          <div className="help-faq-a">{it.a}</div>
        </div>
      ))}
    </div>
  );
}

/** A conversation with Claude, as the hero console shows one, without the
 *  animation. */
export function ExampleSession({ title, lines }: { title: string; lines: SessionLine[] }) {
  return (
    <figure className="console console-static help-session">
      <figcaption className="console-bar">
        <span className="console-dots" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <span className="console-title">{title}</span>
        <span className="console-tag">Example</span>
      </figcaption>
      <div className="console-body">
        {lines.map((l, i) =>
          l.kind === "user" ? (
            <div key={i} className="console-line console-user">
              <span className="console-prompt" aria-hidden>
                &rsaquo;
              </span>{" "}
              {l.text}
            </div>
          ) : l.kind === "tool" ? (
            <div key={i} className="console-line console-tool">
              <span className="console-bullet" aria-hidden />
              walkoff.{l.text}
              {l.note ? <span className="console-dim"> &middot; {l.note}</span> : null}
            </div>
          ) : (
            <div key={i} className={`console-line ${l.kind === "ok" ? "console-ok" : "console-out"}`}>
              {l.text}
            </div>
          ),
        )}
      </div>
    </figure>
  );
}
