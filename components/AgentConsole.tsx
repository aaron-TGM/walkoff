import type { CSSProperties } from "react";
import { Swatches } from "@/components/upload/AffinityReportView";
import { mapHighlights, sampleCampaign } from "@/lib/help/samples";
import { teamByKey } from "@/lib/mcp/teams";
import { territoryName } from "@/lib/outreach/pitch";

// Example session shown in the homepage's Claude section, with the demo
// brand's map and sample campaign (lib/help/samples.ts). Lines reveal one
// after another (CSS only, see .console-line in globals.css).

function line(i: number): CSSProperties {
  return { "--i": i } as CSSProperties;
}

export function AgentConsole() {
  const affinity = mapHighlights(2, 1).map((g) => {
    const team = teamByKey(`${g.league}:${g.teamId}`);
    return { name: team ? territoryName(team) : g.teamName, customers: Math.round(g.customers).toLocaleString("en-US"), lift: g.lift };
  });
  const maxLift = Math.max(...affinity.map((a) => a.lift));
  // A brand with no license: its own colorways, in the team's colors.
  const campaign = sampleCampaign();
  const picks = campaign.products.slice(0, 2);
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
          {affinity.length} team territories stand out
        </div>
        {affinity.map((a) => (
          <div
            key={a.name}
            className="console-line console-row"
            style={line(i++)}
          >
            <span className="console-row-name">{a.name}</span>
            <span className="console-row-num">{a.customers}</span>
            <span className="console-row-bar" aria-hidden>
              <span style={{ width: `${(a.lift / maxLift) * 100}%` }} />
            </span>
            <span className="console-row-lift">{a.lift.toFixed(1)}&times;</span>
          </div>
        ))}

        <div className="console-line console-tool" style={line(i++)}>
          <span className="console-bullet" aria-hidden />
          walkoff.upcoming_games
          <span className="console-dim"> &middot; next 7 days</span>
        </div>
        <div className="console-line console-out" style={line(i++)}>
          <span className="console-when">SUN 1:05P</span> Chiefs at Chargers
          <span className="console-chip">rivalry</span>
        </div>

        <div className="console-line console-tool" style={line(i++)}>
          <span className="console-bullet" aria-hidden />
          walkoff.match_products
          <span className="console-dim"> &middot; their colors, your catalog</span>
        </div>
        {picks.map((p) => (
          <div key={`${p.title}:${p.colorway}`} className="console-line console-out console-pick" style={line(i++)}>
            <Swatches hex={p.hex} />
            {p.title} <span className="console-dim">&middot; {p.colorway}</span>
          </div>
        ))}

        <div className="console-line console-fire" style={line(i++)}>
          <span className="console-fire-tag">Final</span>
          SUN 4:41P &middot; Chargers 27, Chiefs 20
        </div>
        <div className="console-line console-tool" style={line(i++)}>
          <span className="console-bullet" aria-hidden />
          walkoff.build_campaign
        </div>
        <div className="console-line console-out" style={line(i++)}>
          &ldquo;{campaign.subject_lines[0]}&rdquo;{" "}
          {campaign.audience.customers ? (
            <span className="console-dim">
              &middot; {campaign.audience.customers.in_circles.toLocaleString("en-US")} customers
            </span>
          ) : null}
        </div>
        <div className="console-line console-fired" style={line(i++)}>
          Drafted in Klaviyo &middot; waiting for your go-ahead
          <span className="console-cursor" aria-hidden />
        </div>
      </div>
    </figure>
  );
}
