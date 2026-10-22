import type { CSSProperties } from "react";
import { Swatches } from "@/components/upload/AffinityReportView";

// Example session shown in the hero. Lines reveal one after another
// (CSS only, see .console-line in globals.css).

const AFFINITY = [
  { name: "Chargers territory", customers: "2,310", lift: 2.4 },
  { name: "Heat wave zone", customers: "3,902", lift: 1.9 },
  { name: "Arsenal fans, UK", customers: "846", lift: 1.6 },
];

// A brand with no license: its own colorways, in the team's colors.
const PICKS = [
  { title: "Everyday Jogger", colorway: "Azure Heather", hex: "2e8bd8" },
  { title: "Sunday Hoodie", colorway: "Sunflower", hex: "ffc512" },
];

const MAX_LIFT = Math.max(...AFFINITY.map((a) => a.lift));

function line(i: number): CSSProperties {
  return { "--i": i } as CSSProperties;
}

export function AgentConsole() {
  let i = 0;
  return (
    <figure className="console">
      <figcaption className="console-bar">
        <span className="console-dots" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <span className="console-title">claude &middot; walkoff mcp</span>
        <span className="console-tag">Example session</span>
      </figcaption>

      <div className="console-body">
        <div className="console-line console-user" style={line(i++)}>
          <span className="console-prompt" aria-hidden>
            &rsaquo;
          </span>{" "}
          What should we send this weekend?
        </div>

        <div className="console-line console-tool" style={line(i++)}>
          <span className="console-bullet" aria-hidden />
          walkoff.get_affinity_map
        </div>
        <div className="console-line console-out" style={line(i++)}>
          3 groups stand out in your customers
        </div>
        {AFFINITY.map((a) => (
          <div
            key={a.name}
            className="console-line console-row"
            style={line(i++)}
          >
            <span className="console-row-name">{a.name}</span>
            <span className="console-row-num">{a.customers}</span>
            <span className="console-row-bar" aria-hidden>
              <span style={{ width: `${(a.lift / MAX_LIFT) * 100}%` }} />
            </span>
            <span className="console-row-lift">{a.lift.toFixed(1)}&times;</span>
          </div>
        ))}

        <div className="console-line console-tool" style={line(i++)}>
          <span className="console-bullet" aria-hidden />
          walkoff.upcoming_moments
          <span className="console-dim"> &middot; next 72h</span>
        </div>
        <div className="console-line console-out" style={line(i++)}>
          <span className="console-when">SUN 1:05P</span> Raiders at Chargers
          <span className="console-chip">rivalry</span>
        </div>
        <div className="console-line console-out" style={line(i++)}>
          <span className="console-when">SAT</span> Heat wave, Inland Empire
          <span className="console-chip">weather</span>
        </div>

        <div className="console-line console-tool" style={line(i++)}>
          <span className="console-bullet" aria-hidden />
          walkoff.match_products
          <span className="console-dim"> &middot; their colors, your catalog</span>
        </div>
        {PICKS.map((p) => (
          <div key={p.colorway} className="console-line console-out console-pick" style={line(i++)}>
            <Swatches hex={[p.hex]} />
            {p.title} <span className="console-dim">&middot; {p.colorway}</span>
          </div>
        ))}

        <div className="console-line console-tool" style={line(i++)}>
          <span className="console-bullet" aria-hidden />
          walkoff.create_trigger
        </div>
        <div className="console-line console-out" style={line(i++)}>
          Chargers win &rarr; &ldquo;Powder Blue Sunday&rdquo; &rarr; Klaviyo
        </div>
        <div className="console-line console-ok" style={line(i++)}>
          &#10003; Armed &middot; auto-fire rule on
        </div>

        <div className="console-line console-fire" style={line(i++)}>
          <span className="console-fire-tag">Final</span>
          SUN 4:12P &middot; Chargers 27, Raiders 20
        </div>
        <div className="console-line console-fired" style={line(i++)}>
          Fired to 2,310 customers &middot; 2m 14s after the final
          <span className="console-cursor" aria-hidden />
        </div>
      </div>
    </figure>
  );
}
