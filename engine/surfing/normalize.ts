// The season article's tables as events: the schedule gives each event's
// waiting period, and the event results its champions and runners-up,
// matched by the event's link. People write wikitext, so the parsing is
// forgiving: columns are found by their headers, and a row it can't read is
// left out rather than guessed.
import { slugOf } from "../../lib/athletes";
import type { CircuitEvent, CircuitState, Entrant } from "../circuits/poller";

export interface SurfEvent extends CircuitEvent {
  /** "surfing:hurley-pro-at-trestles:2026": the event's article, so it's
   *  the same whatever the event is called that year. */
  key: string;
  /** The waiting period, "2026-09-11" to "2026-09-20". The final can be any
   *  day in it. Null when the article doesn't say. */
  startsOn: string | null;
  endsOn: string | null;
  /** The men's and the women's, those the article names. */
  champions: Entrant[];
  /** Champions and runners-up. A surfer's externalId is their article's
   *  title, "Leonardo Fioravanti (surfer)": Wikidata finds them by it. */
  players: Entrant[];
}

interface Cell {
  header: boolean;
  raw: string;
}

interface Link {
  target: string;
  text: string;
}

/** Wikitext's own [[Links]], [[Title|text]]: never files or categories. */
function links(s: string): Link[] {
  const out: Link[] = [];
  for (const m of s.matchAll(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g)) {
    const target = title(m[1]);
    if (!target || /^(file|image|category):/i.test(target)) continue;
    out.push({ target, text: (m[2] ?? m[1]).trim() });
  }
  return out;
}

/** As Wikipedia writes a title: spaces, not underscores, and a capital. */
function title(s: string): string {
  const t = s.split("#")[0].replace(/_/g, " ").replace(/\s+/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const stripRefs = (s: string) =>
  s
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<ref[^>]*\/>/gi, "")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "");

/** A cell's text, without templates, links' targets, tags or bold. */
function plain(s: string): string {
  let t = stripRefs(s);
  for (let before = ""; before !== t; ) {
    before = t;
    t = t.replace(/\{\{[^{}]*\}\}/g, "");
  }
  return t
    .replace(/\[\[(?:[^\]|]+\|)?([^\]]*)\]\]/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/'{2,}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Cells on one line: "| a || b" or "! a !! b". */
function splitCells(line: string, header: boolean): string[] {
  return line.split(header ? /!!|\|\|/ : /\|\|/);
}

/** Drops a cell's attributes: 'style="..." | text' is "text". */
function content(raw: string): string {
  let depth = 0;
  for (let i = 0; i < raw.length; i++) {
    const two = raw.slice(i, i + 2);
    if (two === "[[" || two === "{{") depth++;
    else if ((two === "]]" || two === "}}") && depth > 0) depth--;
    if (two === "[[" || two === "{{" || two === "]]" || two === "}}") {
      i++;
      continue;
    }
    if (raw[i] === "|" && depth === 0) return raw.slice(i + 1);
  }
  return raw;
}

/** The first table after a heading, like "Event results", as rows. */
function tableAfter(wikitext: string, heading: string): Cell[][] {
  const h = new RegExp(`^=+\\s*${heading}\\s*=+\\s*$`, "im").exec(wikitext);
  if (!h) return [];
  const start = wikitext.indexOf("{|", h.index);
  if (start < 0) return [];
  const end = wikitext.indexOf("\n|}", start);
  const rows: Cell[][] = [];
  let row: Cell[] = [];
  for (const line of wikitext.slice(start, end < 0 ? undefined : end).split("\n").slice(1)) {
    const t = line.trim();
    if (t.startsWith("|-")) {
      if (row.length) rows.push(row);
      row = [];
    } else if (t.startsWith("|+") || !t) {
      continue;
    } else if (t.startsWith("!") || t.startsWith("|")) {
      const header = t.startsWith("!");
      row.push(...splitCells(t.slice(1), header).map((c) => ({ header, raw: content(c).trim() })));
    } else if (row.length) {
      // A cell that runs over more lines.
      row[row.length - 1].raw += `\n${t}`;
    }
  }
  if (row.length) rows.push(row);
  return rows;
}

/** A table's header row, and the rows under it with a cell for each column. */
function columns(rows: Cell[][]): { names: string[]; rows: Cell[][] } {
  const at = rows.findIndex((r) => r.every((c) => c.header));
  if (at < 0) return { names: [], rows: [] };
  const names = rows[at].map((c) => plain(c.raw).toLowerCase());
  return { names, rows: rows.slice(at + 1).filter((r) => r.length >= names.length) };
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const month = (s: string | undefined) => (s && s.length >= 3 ? MONTHS.findIndex((m) => m.startsWith(s.toLowerCase().replace(/\.$/, ""))) : -1);

/** "September 11–20", "August 25 – September 4" or "25 August – 4
 *  September", in the season's year. */
export function waitingPeriod(text: string, year: number): { startsOn: string; endsOn: string } | null {
  const t = plain(text).replace(/\s*[–—-]\s*/g, "–");
  let m1: number, d1: number, m2: number, d2: number;
  const monthFirst = t.match(/^([A-Za-z]+\.?) (\d{1,2})(?:–(?:([A-Za-z]+\.?) )?(\d{1,2}))?$/);
  const dayFirst = t.match(/^(\d{1,2})(?: ([A-Za-z]+\.?))?(?:–(\d{1,2}))? ([A-Za-z]+\.?)$/);
  if (monthFirst) {
    [m1, d1] = [month(monthFirst[1]), Number(monthFirst[2])];
    [m2, d2] = [monthFirst[3] ? month(monthFirst[3]) : m1, monthFirst[4] ? Number(monthFirst[4]) : d1];
  } else if (dayFirst) {
    [m2, d2] = [month(dayFirst[4]), dayFirst[3] ? Number(dayFirst[3]) : Number(dayFirst[1])];
    [m1, d1] = [dayFirst[2] ? month(dayFirst[2]) : m2, Number(dayFirst[1])];
  } else return null;
  const day = (m: number, d: number) => {
    const at = new Date(Date.UTC(year, m, d));
    return m >= 0 && at.getUTCMonth() === m && at.getUTCDate() === d ? at.toISOString().slice(0, 10) : null;
  };
  const startsOn = day(m1, d1);
  const endsOn = day(m2, d2);
  return startsOn && endsOn && endsOn >= startsOn ? { startsOn, endsOn } : null;
}

/** "TBD", "Cancelled" and the like aren't surfers. */
const NOT_A_NAME = /^(tbd|tba|n\/a|none|cancell?ed|postponed)$/i;

/** The surfer a results cell names: their article, or a plain name. */
function surfer(raw: string): Entrant | null {
  const link = links(stripRefs(raw))[0];
  if (link) {
    // [[Tyler Wright (surfer)]] is Tyler Wright.
    const name = (link.text === link.target ? link.text.replace(/\s*\([^)]*\)$/, "") : plain(link.text)).trim();
    return name ? { externalId: link.target, name } : null;
  }
  const name = plain(raw);
  return /^\p{L}[\p{L}'’.-]*( \p{L}[\p{L}'’.-]*)+$/u.test(name) && !NOT_A_NAME.test(name) ? { externalId: name, name } : null;
}

/** An event cell: its article and name, and whether it's struck out. */
function eventOf(raw: string): { slug: string; name: string; struck: boolean } | null {
  const link = links(stripRefs(raw))[0];
  const name = link ? plain(link.text) : plain(raw);
  if (!name) return null;
  return { slug: slugOf(link?.target ?? name), name, struck: /<(s|del|strike)>/i.test(raw) };
}

const listOf = (names: string[]) => (names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`);

/** Each event in the season's article, in order. */
export function parseSeason(wikitext: string, year: number): SurfEvent[] {
  const schedule = columns(tableAfter(wikitext, "Schedule"));
  const results = columns(tableAfter(wikitext, "Event results"));
  const col = (names: string[], re: RegExp) => names.findIndex((n) => re.test(n));

  const dates = new Map<string, { name: string; startsOn: string | null; endsOn: string | null; struck: boolean }>();
  const order: string[] = [];
  const eventCol = col(schedule.names, /^event$/);
  const dateCol = col(schedule.names, /^dates?$/);
  for (const r of schedule.rows) {
    const e = eventCol >= 0 ? eventOf(r[eventCol].raw) : null;
    if (!e) continue;
    const period = dateCol >= 0 ? waitingPeriod(r[dateCol].raw, year) : null;
    dates.set(e.slug, { name: e.name, startsOn: period?.startsOn ?? null, endsOn: period?.endsOn ?? null, struck: e.struck || r.some((c) => /<(s|del|strike)>/i.test(c.raw)) });
    order.push(e.slug);
  }

  const winners = new Map<string, { name: string; champions: Entrant[]; players: Entrant[]; divisions: number; struck: boolean }>();
  const resultCol = col(results.names, /^event$/);
  const championCols = results.names.flatMap((n, i) => (/champion/.test(n) ? [i] : []));
  const runnerUpCols = results.names.flatMap((n, i) => (/runner/.test(n) ? [i] : []));
  for (const r of results.rows) {
    const e = resultCol >= 0 ? eventOf(r[resultCol].raw) : null;
    if (!e) continue;
    const champions = championCols.map((i) => surfer(r[i].raw)).filter((s): s is Entrant => s !== null);
    const runnersUp = runnerUpCols.map((i) => surfer(r[i].raw)).filter((s): s is Entrant => s !== null);
    winners.set(e.slug, { name: e.name, champions, players: [...champions, ...runnersUp], divisions: championCols.length, struck: e.struck });
    if (!dates.has(e.slug)) order.push(e.slug);
  }

  return order.map((slug): SurfEvent => {
    const d = dates.get(slug);
    const w = winners.get(slug);
    const champions = w?.champions ?? [];
    const state: CircuitState = d?.struck || w?.struck ? "off" : w && champions.length === w.divisions && champions.length > 0 ? "final" : champions.length ? "in" : "pre";
    const statusLine =
      state === "off"
        ? "Canceled"
        : champions.length
          ? `Champions: ${listOf(champions.map((c) => c.name))}`
          : d?.startsOn
            ? `Waiting period ${d.startsOn} to ${d.endsOn}`
            : "No dates yet";
    return {
      id: `wikipedia:surfing:${year}:${slug}`,
      key: `surfing:${slug}:${year}`,
      name: w?.name ?? d!.name,
      state,
      statusLine,
      startsOn: d?.startsOn ?? null,
      endsOn: d?.endsOn ?? null,
      champions,
      players: w?.players ?? [],
    };
  });
}
