// Product tags Walkoff uses to match products to fans and moments. The
// rules here run instantly on upload; scripts/tag-catalog.ts refines them
// with Claude. Both produce the same ProductTags.
import { TEAM_HOMES, type TeamHome } from "./geo";
import type { CatalogItem } from "./imports";

export interface TeamTag {
  league: string;
  teamId: string;
  name: string;
  /** Claude's reason, quoting the product text ("says Bird Gang"). */
  why?: string;
}

export interface ProductTags {
  teams: TeamTag[];
  colors: string[];
  uses: string[];
  seasons: string[];
  /** Scenes beyond team sports (surf, fishing, western) for moments like a
   *  swell or a hot bite. */
  interests: string[];
}

export const USES = ["cold_weather", "tailgate", "game_day", "home", "gift", "kids", "pets", "summer"] as const;
export const SEASONS = ["spring", "summer", "fall", "winter"] as const;
export const INTERESTS = [
  "surf", "skate", "snow", "fishing", "hunting", "western", "golf", "tennis", "motorsports",
  "outdoors", "cycling", "running", "fitness", "music",
] as const;
export const COLORS = [
  "midnight green", "kelly green", "forest green", "green", "navy", "royal blue", "light blue", "blue",
  "red", "scarlet", "crimson", "maroon", "burgundy", "orange", "gold", "yellow", "purple", "black",
  "white", "gray", "silver", "teal", "pink", "brown", "cream", "tan", "olive", "charcoal", "sage",
] as const;

const PRO = ["nfl", "nba", "nhl", "mlb"];
const COLLEGE = ["ncaaf", "ncaab"];

const LEAGUE_HINTS: Record<string, string[]> = {
  nfl: ["nfl", "football", "gridiron", "touchdown", "super bowl"],
  ncaaf: ["college football", "football", "bowl game"],
  nba: ["nba", "basketball", "hoops"],
  ncaab: ["college basketball", "basketball", "march madness", "hoops"],
  nhl: ["nhl", "hockey", "puck", "stanley cup"],
  mlb: ["mlb", "baseball", "ballpark", "world series"],
  epl: ["premier league", "soccer", "football club", "epl", "kit", "home kit", "away kit"],
};

/** Nicknames that are everyday words, prints or products: "diamante stars",
 *  "heat transfer", "teddy bears", "phone chargers", anything orange. Alone,
 *  one counts only with the team's sport, its place or a fan's words
 *  ("Stars hockey", "Dallas", "Go Stars"). Full names always count. */
const EVERYDAY = new Set([
  "angels", "avalanche", "badgers", "bears", "bills", "blue jays", "bluejays", "blues", "braves", "brewers", "broncos", "browns",
  "buccaneers", "bucks", "buffaloes", "bulldogs", "bulls", "capitals", "cardinal", "cardinals", "cavaliers", "chargers",
  "chiefs", "clippers", "colts", "cougars", "cowboys", "cubs", "cyclones", "devils", "dolphins", "ducks", "flames",
  "flyers", "gators", "giants", "grizzlies", "guardians", "hawks", "heat", "hornets", "hurricanes", "huskies",
  "islanders", "jaguars", "jazz", "jets", "kings", "knights", "kraken", "lightning", "lions", "longhorns", "magic",
  "mammoth", "mariners", "marlins", "mavericks", "mountaineers", "mustangs", "nationals", "nets", "nuggets", "orange",
  "orioles", "pacers", "panthers", "patriots", "pelicans", "penguins", "pirates", "pistons", "predators", "raiders",
  "rams", "rangers", "raptors", "ravens", "rays", "rebels", "reds", "rockets", "rockies", "royals", "saints", "sharks",
  "spartans", "spurs", "stars", "suns", "texans", "thunder", "tigers", "titans", "trail blazers", "trojans", "twins",
  "vikings", "volunteers", "warriors", "wild", "wildcats", "wizards",
]);

/** Words that put a product at the game, whatever the team. */
const FAN_WORDS = ["game day", "gameday", "tailgate", "tailgating", "playoffs", "playoff", "season tickets"];

/** How fans cheer a team by its nickname: "Go Stars", "Bears fans". */
const cheers = (nickname: string) => [`go ${nickname}`, `${nickname} fan`, `${nickname} fans`, `${nickname} nation`, `${nickname} kingdom`, `${nickname} mafia`];

/** Common names for Premier League clubs, by feed abbreviation. */
const EPL_ALIASES: Record<string, string[]> = {
  TOT: ["spurs", "tottenham"],
  MAN: ["man united", "man utd", "manchester united"],
  MNC: ["man city", "manchester city"],
  ARS: ["arsenal", "gunners"],
  CHE: ["chelsea"],
  LIV: ["liverpool"],
  EVE: ["everton", "toffees"],
  NEW: ["newcastle", "toon"],
  AVL: ["aston villa"],
  BHA: ["brighton"],
  BOU: ["bournemouth"],
  NFO: ["nottingham forest"],
  CRY: ["crystal palace"],
  LEE: ["leeds"],
  SUN: ["sunderland"],
  IPS: ["ipswich"],
  HUL: ["hull city"],
  COV: ["coventry"],
  FUL: ["fulham"],
  BRE: ["brentford"],
};

const USE_WORDS: Record<(typeof USES)[number], string[]> = {
  cold_weather: ["hoodie", "sweatshirt", "crewneck", "beanie", "jacket", "fleece", "blanket", "scarf", "gloves", "pullover", "quarter zip", "puffer", "parka", "sherpa"],
  tailgate: ["koozie", "can cooler", "cooler", "tumbler", "drinkware", "bottle opener", "flask", "tailgate", "cornhole", "chair", "shot glass", "pint glass"],
  game_day: ["jersey", "tee", "t shirt", "shirt", "hat", "cap", "snapback", "foam finger", "flag", "game day", "gameday"],
  home: ["mug", "pillow", "sign", "decor", "poster", "print", "ornament", "towel", "blanket"],
  gift: ["gift", "bundle", "gift card", "gift set", "box set"],
  kids: ["kids", "youth", "toddler", "baby", "infant", "onesie"],
  pets: ["dog", "pet", "cat", "collar", "leash"],
  summer: ["shorts", "boardshorts", "boardshort", "swim", "sunglasses", "tank top", "visor", "sunscreen"],
};

// Words that mean the product is made for the scene, not just a passing
// mention. Claude reads the rest.
const INTEREST_WORDS: Record<(typeof INTERESTS)[number], string[]> = {
  surf: ["surf", "surfing", "surfer", "surfboard", "boardshort", "boardshorts", "wetsuit", "rash guard", "rashguard", "surf wax"],
  skate: ["skate", "skateboard", "skateboarding", "skater", "grip tape"],
  snow: ["ski", "skiing", "snowboard", "snowboarding", "apres ski"],
  fishing: ["fishing", "fisherman", "angler", "angling", "fly fishing", "tackle", "lure"],
  hunting: ["hunting", "hunter", "duck hunting", "deer hunting", "waterfowl"],
  western: ["western", "rodeo", "cowboy", "cowgirl", "ranch", "pearl snap", "bronc"],
  golf: ["golf", "golfer", "golfing", "putter"],
  tennis: ["tennis", "tennis racket", "tennis racquet"],
  motorsports: ["motocross", "supercross", "moto", "dirt bike", "nascar", "formula 1", "racing"],
  outdoors: ["outdoors", "outdoor", "camping", "hiking", "backpacking", "climbing", "trail"],
  cycling: ["cycling", "bike", "bicycle", "bmx", "mtb", "mountain bike"],
  running: ["running", "runner", "marathon", "trail running"],
  fitness: ["gym", "workout", "yoga", "fitness", "crossfit"],
  music: ["concert", "music festival", "vinyl", "music"],
};

/** " text with spaces " for whole-word matching. */
function prep(s: string): string {
  return ` ${s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim()} `;
}

function contains(text: string, phrase: string): boolean {
  return text.includes(` ${prep(phrase).trim()} `);
}

interface Candidate {
  league: string;
  team: TeamHome;
  /** A school counts once across football and basketball. */
  identity: string;
}

interface Matcher {
  phrase: string;
  candidates: Candidate[];
  /** An everyday word ("stars"): it needs the team's context to count. */
  everyday: boolean;
}

let matchers: Matcher[] | null = null;

function buildMatchers(): Matcher[] {
  const phrases = new Map<string, Candidate[]>();
  const add = (phrase: string, league: string, team: TeamHome) => {
    const key = prep(phrase).trim();
    if (!key) return;
    const identity = COLLEGE.includes(league) ? `college:${team.id}` : `${league}:${team.id}`;
    const list = phrases.get(key) ?? [];
    if (!list.some((c) => c.league === league && c.team.id === team.id)) list.push({ league, team, identity });
    phrases.set(key, list);
  };
  const proLocations = new Set(PRO.flatMap((l) => (TEAM_HOMES[l] ?? []).map((t) => t.location.toLowerCase())));

  for (const league of PRO) {
    for (const team of TEAM_HOMES[league] ?? []) {
      add(team.name, league, team);
      if (team.nickname && team.nickname !== team.location) add(team.nickname, league, team);
    }
  }
  for (const league of COLLEGE) {
    for (const team of TEAM_HOMES[league] ?? []) {
      add(team.name, league, team);
      // Power programs also by school ("Ohio State") and nickname
      // ("Buckeyes"), unless a pro team uses that place name ("Miami").
      if (team.weight < 1) continue;
      if (!proLocations.has(team.location.toLowerCase())) add(team.location, league, team);
      add(team.nickname, league, team);
    }
  }
  for (const team of TEAM_HOMES.epl ?? []) {
    for (const phrase of [team.name, ...(EPL_ALIASES[team.abbr] ?? [])]) add(phrase, "epl", team);
  }

  return [...phrases.entries()]
    .map(([phrase, candidates]) => ({ phrase, candidates, everyday: EVERYDAY.has(phrase) }))
    // Longest first, so "Michigan State" wins over "Michigan".
    .sort((a, b) => b.phrase.length - a.phrase.length);
}

/** Settles a name several teams share. Between pro and college, one pro
 *  team beats any number of colleges ("Eagles" is Philadelphia) unless the
 *  product says college. Otherwise it must come down to one team. */
function settle(candidates: Candidate[], saysCollege: boolean): Candidate[] {
  const teams = (list: Candidate[]) => new Set(list.map((c) => c.identity)).size;
  const pro = candidates.filter((c) => PRO.includes(c.league));
  const college = candidates.filter((c) => COLLEGE.includes(c.league));
  if (pro.length && college.length && pro.length + college.length === candidates.length) {
    if (saysCollege) return teams(college) === 1 ? college : [];
    return teams(pro) === 1 ? pro : [];
  }
  return teams(candidates) === 1 ? candidates : [];
}

export function tagProduct(item: Pick<CatalogItem, "title" | "productType" | "category" | "tags" | "description">): ProductTags {
  matchers ??= buildMatchers();
  const text = prep([item.title, item.productType, item.category, item.tags.join(" "), item.description].join(" "));
  const hinted = new Set(
    Object.entries(LEAGUE_HINTS)
      .filter(([, words]) => words.some((w) => contains(text, w)))
      .map(([league]) => league),
  );

  const saysCollege = ["college", "ncaa", "university", "march madness", "bowl game"].some((w) => contains(text, w));

  const atTheGame = FAN_WORDS.some((w) => contains(text, w));

  const teams = new Map<string, TeamTag>();
  let remaining = text;
  for (const m of matchers) {
    if (!contains(remaining, m.phrase)) continue;
    // An everyday word is left in the text, so "orange" still reads as a color.
    const pool =
      m.everyday && !atTheGame && !cheers(m.phrase).some((p) => contains(text, p))
        ? m.candidates.filter((c) => hinted.has(c.league) || contains(text, c.team.location))
        : m.candidates;
    if (!pool.length) continue;
    // A name more than one team or school shares ("Giants", "Spurs") needs
    // a sport word to count.
    let chosen = pool;
    if (new Set(pool.map((c) => c.identity)).size > 1) {
      const inSport = pool.filter((c) => hinted.has(c.league));
      chosen = settle(inSport.length ? inSport : pool, saysCollege);
    }
    if (!chosen.length) continue;
    for (const c of chosen) {
      teams.set(`${c.league}:${c.team.id}`, { league: c.league, teamId: c.team.id, name: c.team.name });
    }
    // Consume the phrase so "Michigan State" doesn't also tag "Michigan".
    remaining = remaining.replace(` ${m.phrase} `, " _ ");
  }
  // "Ohio State" alone is school fandom; with a sport word, keep that sport.
  const tagged = [...teams.values()];
  const collegeHints = COLLEGE.filter((l) => hinted.has(l));
  const filtered =
    collegeHints.length === 1
      ? tagged.filter((t) => !COLLEGE.includes(t.league) || t.league === collegeHints[0])
      : tagged;

  // Read colors with team names removed: "Blue Devils" isn't a blue product.
  const colors = COLORS.filter((c) => contains(remaining, c)).filter(
    (c, _, all) => !all.some((o) => o !== c && o.endsWith(` ${c}`)),
  );
  const uses = USES.filter((u) => USE_WORDS[u].some((w) => contains(text, w)));
  const seasons = new Set<string>(SEASONS.filter((s) => contains(text, s)));
  if (uses.includes("cold_weather")) ["fall", "winter"].forEach((s) => seasons.add(s));
  if (uses.includes("summer")) seasons.add("summer");
  if (contains(text, "holiday") || contains(text, "christmas")) seasons.add("winter");
  const interests = INTERESTS.filter((i) => INTEREST_WORDS[i].some((w) => contains(text, w)));

  return { teams: filtered, colors: [...colors], uses: [...uses], seasons: [...seasons], interests: [...interests] };
}
