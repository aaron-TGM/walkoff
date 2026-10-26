// Copy for hometown campaigns: the town celebrates. Without an athlete's
// written OK on file (brand_athlete_rights, in date), copy never names or
// describes the athlete: no name, nickname, initials, number, position,
// school or photo, and nothing like "local kid" or "hometown hero". No
// team, league or event names either. The town's name and the colors carry
// it. lib/testing/names.ts checks.
import type { HometownType } from "./derive";

export interface HometownCopyInput {
  type: HometownType;
  /** "San Clemente". */
  town: string;
  /** The champion's colors, in the brand's own words: "Navy and green".
   *  Null for an athlete without a team. */
  colors: { phrase: string; main: string } | null;
  /** When it happened where the town is: after 5 PM is a night. */
  partOfDay: "night" | "day";
  /** Contenders: when the final round is, "tomorrow" or "on Sunday". */
  when: string;
  /** The first product, like "the Pier Hoodie in navy". */
  product: string | null;
  /** An athlete the brand may name: written rights in date. */
  mayName: string | null;
}

export interface HometownCopy {
  angle: string;
  subjects: string[];
  preview: string;
  headline: string;
  body: string;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function hometownCopy(c: HometownCopyInput): HometownCopy {
  const { town, partOfDay: part } = c;
  const Colors = c.colors ? cap(c.colors.phrase) : null;
  const picked = c.colors ? "We picked a few things in the colors everyone there is wearing." : "We picked a few things to celebrate in.";
  if (c.type === "hometown_contender") {
    return {
      angle: "The town is watching: someone from here leads going into the final round. The town's name carries it.",
      subjects: [`All eyes on ${town} ${c.when}.`, `${town}, big day ${c.when}.`, `${town} is watching.`],
      preview: c.product ? `What to wear while you watch: ${c.product}, and more.` : "What to wear while you watch.",
      headline: `All eyes on ${town}.`,
      body: `${town} has a big day ${c.when}. Here's what to wear while you watch.`,
    };
  }
  const title = c.type === "hometown_title";
  const finish = c.type === "hometown_game_winner";
  const what = finish ? "finish" : part;
  const subjects = [`${town}, what a ${what}.`, Colors ? `${Colors} all over ${town} today.` : `${town} is celebrating.`, `Big ${part} for ${town}.`];
  const lead = c.mayName ? `${c.mayName} did it, and ${town} has a lot to celebrate today.` : `${town} has a lot to celebrate today.`;
  return {
    angle: title
      ? "The town is celebrating: someone from here just won it all. The town's name and the colors carry it."
      : finish
        ? "The town is celebrating: someone from here just won a playoff game at the very end. The town's name and the colors carry it."
        : "The town is celebrating: someone from here just won. The town's name carries it.",
    subjects: c.mayName ? [`${c.mayName} did it. ${town}, what a ${what}.`, ...subjects.slice(1)] : subjects,
    preview: c.colors ? `A few things in the colors ${town} is wearing today.` : `A few things for ${town} to celebrate in.`,
    headline: `${town}, what a ${what}.`,
    body: `${lead} ${picked}`,
  };
}

/** The rules every hometown campaign carries, for Claude and the marketer. */
export function hometownRules(o: { brand: string; licensed: boolean; mayName: { name: string; through: string } | null }): string[] {
  const rules = [
    o.mayName
      ? `${o.mayName.name} agreed in writing that ${o.brand} may name them, through ${o.mayName.through}. Stay within that agreement: get their OK for each use, and use photos only if it covers them. Other athletes from the town still go unnamed.`
      : 'Celebrate the town, never the athlete: no name, nickname, initials, number, position, school or photo, and nothing like "local kid", "one of our own", "hometown hero" or "born and raised".',
    o.licensed
      ? "Team marks only within the brand's license. No league or event names, trophies or footage."
      : "Never name the team, league or event: no Super Bowl, World Series, Masters or Wimbledon. No logos, trophies or footage.",
    "Don't say or imply that an athlete or team endorses the brand.",
    "The town's name and the colors are the whole signal. Send only to the town's circle, never the whole list.",
    "Walkoff's rules lower the risk but aren't legal advice. When in doubt, ask counsel.",
  ];
  return rules;
}
