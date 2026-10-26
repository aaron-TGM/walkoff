// The moments page's tables, straight from the lists the engine and the
// queue use. Static, so every row is in the page's HTML.
import { FINISHES, LEAGUE_FACTS } from "@/lib/help/moments";
import { hometownLive } from "@/lib/hometown/flag";
import { momentKind } from "@/lib/mcp/campaign";
import { defaultRule, WINDOW_HOURS } from "@/lib/mcp/queue";
import { brandTriggers, TRIGGER_CATEGORIES } from "@/lib/triggers";

const WINDOW: Record<ReturnType<typeof momentKind>, string> = {
  win: `About ${WINDOW_HOURS.result} hours`,
  loss: `About ${WINDOW_HOURS.result} hours`,
  season: `About ${WINDOW_HOURS.season / 24} days`,
  live: `About ${WINDOW_HOURS.live} hours`,
  pregame: "Until kickoff",
};

/** Where a moment's window isn't its kind's. */
const WINDOW_OF: Record<string, string> = {
  hometown_contender: "Until the final round, or the final, starts",
};

export function MomentTables() {
  const hometown = hometownLive();
  const triggers = brandTriggers(hometown);
  const rule = defaultRule(hometown);
  return TRIGGER_CATEGORIES.map((c) => (
    <div key={c.id}>
      <h3>{c.label}</h3>
      <div className="help-table-wrap">
        <table className="help-table help-table-moments help-table-stack">
          <thead>
            <tr>
              <th>Moment</th>
              <th>What it is</th>
              <th>Worth acting on</th>
              <th>In the default rule</th>
            </tr>
          </thead>
          <tbody>
            {triggers.filter((t) => t.category === c.id).map((t) => {
              const inDefault = rule.moment_types.includes(t.id);
              return (
                <tr key={t.id} id={`moment-${t.id}`}>
                  <td>
                    {t.name}
                    {t.coming ? (
                      <>
                        {" "}
                        <span className="help-badge help-badge-soon">Coming</span>
                      </>
                    ) : null}
                  </td>
                  <td>{t.description}</td>
                  <td data-label="Worth acting on">{t.coming ? "Not detected yet" : (WINDOW_OF[t.id] ?? WINDOW[momentKind(t.id)])}</td>
                  <td data-label="In the default rule">{inDefault ? (t.coming ? "Yes, once live" : "Yes") : "No"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  ));
}

export function FinishTable() {
  return (
    <div className="help-table-wrap">
      <table className="help-table">
        <thead>
          <tr>
            <th>Moment</th>
            <th>Sport</th>
            <th>When it counts</th>
          </tr>
        </thead>
        <tbody>
          {FINISHES.map((f) => (
            <tr key={`${f.moment}:${f.sport}`}>
              <td>{f.moment}</td>
              <td>{f.sport}</td>
              <td>{f.text}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LeagueTable() {
  return (
    <div className="help-table-wrap">
      <table className="help-table">
        <thead>
          <tr>
            <th>League</th>
            <th>A comeback win is from</th>
            <th>Every win in the default queue</th>
          </tr>
        </thead>
        <tbody>
          {LEAGUE_FACTS.map((l) => (
            <tr key={l.id}>
              <td>
                {l.name}
                {l.note ? <span className="help-dim"> &middot; {l.note}</span> : null}
              </td>
              <td>{l.comeback} down</td>
              <td>{l.everyWin ? "Yes" : "No, only the big ones"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
