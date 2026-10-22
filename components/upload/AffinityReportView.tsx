import type { AffinityReport, TeamGroup } from "@/lib/affinity/compute";

/** Color dots. Only plain hex reaches the style attribute. */
export function Swatches({ hex, label }: { hex: string[]; label?: string }) {
  const colors = hex.filter((h) => /^[0-9a-f]{6}$/i.test(h)).slice(0, 3);
  if (!colors.length) return null;
  return (
    <span className="swatches" aria-label={label} role={label ? "img" : undefined}>
      {colors.map((h) => (
        <i key={h} className="swatch" style={{ background: `#${h}` }} />
      ))}
    </span>
  );
}

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

function pct(n: number): string {
  return `${(n * 100).toFixed(n < 0.1 ? 1 : 0)}%`;
}

function topMatch(g: TeamGroup, hasOrders: boolean): { label: string; value: string } {
  if (g.products[0]) {
    return { label: "Buys more of", value: `${g.products[0].product} (${g.products[0].lift}×)` };
  }
  if (g.taggedProducts[0]) return { label: "Your matching product", value: g.taggedProducts[0] };
  return hasOrders
    ? { label: "Products", value: "Buys the same mix as everyone else" }
    : { label: "Products", value: "Add your order export to see what they buy" };
}

export function AffinityReportView({ report }: { report: AffinityReport }) {
  const { totals, standouts, leagues } = report;
  return (
    <div className="report">
      <p className="report-summary">
        {fmt(totals.matchedCustomers)} customers placed across {fmt(totals.areas)} postal areas
        {totals.unmatchedCustomers > 0
          ? ` · ${fmt(totals.unmatchedCustomers)} outside the US, Canada and the UK or without a usable postal code`
          : ""}
        .
      </p>

      {standouts.length ? (
        <div className="report-grid">
          {standouts.map((g) => {
            const match = topMatch(g, totals.productOrders > 0);
            const picks = g.picks ?? [];
            return (
              <div key={`${g.league}:${g.teamId}`} className="affinity-card">
                <div className="affinity-lift">{g.lift}&times;</div>
                <div className="affinity-group">
                  {g.teamName}
                  <Swatches hex={g.colors ?? []} label={`${g.teamName} colors`} />
                </div>
                <div className="affinity-customers">
                  {fmt(g.customers)} customers &middot; {g.leagueName}
                </div>
                {picks.length ? (
                  <div className="affinity-picks">
                    <span className="affinity-label">On a win, feature</span>
                    {picks.slice(0, 2).map((p) => (
                      <div key={`${p.title}:${p.colorway}`} className="affinity-pick">
                        <Swatches hex={p.hex} />
                        <div>
                          {p.title}
                          {p.colorway ? <em> &middot; {p.colorway}</em> : null}
                          <small>{p.why}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
                {!picks.length || g.products[0] ? (
                  <div className="affinity-match">
                    <span>{match.label}</span>
                    {match.value}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="report-empty">
          No team&apos;s territory stands out yet: your customers are spread much like the
          population. That&apos;s useful too: national moments will reach them everywhere.
        </p>
      )}
      <p className="affinity-foot report-foot">
        2.4&times; means 2.4 times more of your customers live in that team&apos;s territory
        than population alone would predict. Only differences too large to be chance are
        shown. Picks match your colorways to the team&apos;s colors, so no logo or license is
        needed.
      </p>

      <div className="report-leagues">
        {leagues.map((l) => (
          <div key={l.league} className="report-league">
            <div className="report-league-head">
              <span className="report-league-name">{l.leagueName}</span>
              <span className="report-league-count">{fmt(l.customers)} customers</span>
            </div>
            <table className="report-table">
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Customers</th>
                  <th>Share</th>
                  <th>vs. population</th>
                </tr>
              </thead>
              <tbody>
                {l.teams.map((t) => (
                  <tr key={t.teamId}>
                    <td>{t.teamName}</td>
                    <td>{fmt(t.customers)}</td>
                    <td>{pct(t.share)}</td>
                    <td className={t.lift >= 1.25 ? "report-up" : t.lift <= 0.8 ? "report-down" : ""}>
                      {t.lift}&times;
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
