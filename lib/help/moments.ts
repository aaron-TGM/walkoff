// How each sport's big finishes become moments, for the moments page. The
// thresholds live in the engine's rules; help.test.ts checks each "check"
// is still in engine/moments/rules.ts, so the page can't drift from them.
import { LEAGUE_RULES } from "../../engine/moments/sports";
import type { Sport } from "../../engine/moments/types";
import { LEAGUES } from "../leagues";
import { DEFAULT_RULE } from "../mcp/queue";

export const FINISHES: { moment: string; sport: string; text: string; check: string }[] = [
  { moment: "Walk-Off Win", sport: "Baseball", text: "The home team wins in its last at-bat, starting it tied or behind.", check: "Home team won in a bottom half it started tied or behind." },
  { moment: "Walk-Off Win", sport: "Hockey", text: "Won in overtime or a shootout.", check: "g.period <= rules.regulationPeriods" },
  { moment: "Walk-Off Win", sport: "Football", text: "Won in overtime, or with a score in the last 10 seconds.", check: "decisive.clock <= 10" },
  { moment: "Late Winner", sport: "Football", text: "The winning score in the last 2 minutes.", check: "decisive.clock <= 120" },
  { moment: "Buzzer Beater", sport: "Basketball", text: "The winning shot with 3 seconds or less left.", check: "decisive.clock <= 3" },
  { moment: "Late Winner", sport: "Basketball", text: "The winning basket in the last minute.", check: "decisive.clock <= 60" },
  { moment: "Late Winner", sport: "Soccer", text: `The winning goal from the ${LEAGUE_RULES.epl.lateWindow}th minute on.`, check: "decisive.clock < rules.lateWindow" },
];

const UNIT: Record<Sport, [string, string]> = {
  football: ["point", "points"],
  basketball: ["point", "points"],
  hockey: ["goal", "goals"],
  soccer: ["goal", "goals"],
  baseball: ["run", "runs"],
};

/** Each league: what counts as a comeback, and whether an ordinary win
 *  clears the default rule's bar. */
export const LEAGUE_FACTS = LEAGUES.map((l) => {
  const r = LEAGUE_RULES[l.id];
  const [one, many] = UNIT[r.sport];
  return {
    id: l.id,
    name: l.name,
    note: l.note ?? null,
    comeback: `${r.comebackDeficit} ${r.comebackDeficit === 1 ? one : many}`,
    everyWin: r.winIntensity >= DEFAULT_RULE.min_intensity,
  };
});
