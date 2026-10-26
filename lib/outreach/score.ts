// How well a prospect's own catalog wears its home teams' colors. The pitch
// is the sample email, so a store whose products don't match isn't worth
// paying to find a contact for. Reads the store's public product feed (the
// read import_catalog does) and picks what build_campaign would feature.
// Only common color names count ("Azure Heather"): fanciful ones ("Dune")
// wait for Claude in onboarding, so some good stores score low here.
import { hexForColorName } from "../affinity/colors";
import type { CatalogItem } from "../affinity/imports";
import { pickForTeam, type Pick, type PickProduct } from "../affinity/pick";
import { fetchStorefrontCatalog, StorefrontError } from "../affinity/storefront";
import { tagProduct } from "../affinity/tagging";
import type { Lookup } from "../public-fetch";
import { teamByKey } from "../mcp/teams";
import type { HomeTeam } from "./home";

/** At or above this, the sample email is worth sending. */
export const QUALIFY = 0.6;

/** Four pages is 1,000 products: plenty to find three in a team's colors,
 *  and gentle on stores that never asked to be read. */
const FEED_PAGES = 4;

export interface TeamScore extends HomeTeam {
  score: number;
  /** What the sample email would feature, best first. */
  picks: Pick[];
}

export interface ScoreResult {
  verdict: "qualified" | "skipped";
  score: number;
  /** The home team the catalog wears best. */
  best: TeamScore | null;
  /** Every home team, best first. */
  teams: TeamScore[];
  products: number;
  colorways: number;
  reason: string;
  /** When the feed was read only in part. */
  note?: string;
}

/** The catalog as pickForTeam reads it, tagged by the rules alone: what
 *  saveCatalog and loadTaggedCatalog do, without saving anything. Picks go
 *  by color only. Rules-only team tags misfire on everyday words ("diamante
 *  stars" isn't the Dallas Stars), and most prospects have no license. */
export function pickProducts(items: CatalogItem[]): PickProduct[] {
  return items.map((item) => {
    const tags = tagProduct(item);
    return {
      handle: item.handle,
      title: item.title,
      teams: [],
      colors: tags.colors,
      uses: tags.uses,
      interests: tags.interests,
      price: item.price,
      colorways: item.colorways.map((c) => ({ ...c, hex: hexForColorName(c.name) })),
    };
  });
}

/** 0 to 1: how good a three-product email in the team's colors would look.
 *  Each of the three slots counts its pick's color match (a product made
 *  for the team counts in full), half without a photo, and nothing empty. */
export function teamScore(picks: Pick[]): number {
  const slots = [0, 1, 2].map((i) => {
    const p = picks[i];
    if (!p) return 0;
    const match = Math.min(1, p.score);
    return p.image ? match : match / 2;
  });
  return Math.round((slots.reduce((s, x) => s + x, 0) / 3) * 100) / 100;
}

const lean = (p: Pick): Pick => ({ ...p, skus: [] });

const named = (picks: Pick[]) => picks.map((p) => (p.colorway ? `${p.title} in ${p.colorway}` : p.title)).join(", ");

/** Every home team's picks and score, and whether the store qualifies. */
export function scoreCatalog(items: CatalogItem[], home: HomeTeam[]): ScoreResult {
  const products = pickProducts(items);
  const colorways = items.reduce((n, i) => n + i.colorways.length, 0);
  const teams: TeamScore[] = home
    .flatMap((h) => {
      const ref = teamByKey(h.key);
      if (!ref) return [];
      const picks = pickForTeam(products, ref.league, ref.team, 3).map(lean);
      return [{ ...h, score: teamScore(picks), picks }];
    })
    // Best match first; among equals, the team more of the town follows.
    .sort((a, b) => b.score - a.score || b.share - a.share);
  const best = teams[0] ?? null;
  const base = { products: items.length, colorways, teams, best, score: best?.score ?? 0 };
  if (!home.length) {
    return { ...base, verdict: "skipped", reason: "No home teams: the store isn't placed in the US, Canada or the UK." };
  }
  if (!best || best.score < QUALIFY) {
    const near = best?.picks.length ? ` Closest: the ${best.name} at ${best.score}, with ${named(best.picks)}.` : "";
    return { ...base, verdict: "skipped", reason: `Too few products in its home teams' colors.${near}` };
  }
  return { ...base, verdict: "qualified", reason: `Wears the ${best.name} well (${best.score}): ${named(best.picks)}.` };
}

/** Reads the store's feed and scores it. A store whose feed can't be read
 *  is skipped, with the reason; one with no home teams isn't read at all. */
export async function scoreProspect(
  storeUrl: string,
  home: HomeTeam[],
  o: { fetch?: typeof fetch; lookup?: Lookup } = {},
): Promise<ScoreResult> {
  if (!home.length) return scoreCatalog([], []);
  try {
    const feed = await fetchStorefrontCatalog(storeUrl, { ...o, maxPages: FEED_PAGES });
    const result = scoreCatalog(feed.items, home);
    return feed.complete ? result : { ...result, note: `Read the first ${feed.items.length.toLocaleString("en-US")} products.` };
  } catch (err) {
    if (!(err instanceof StorefrontError)) throw err;
    return { verdict: "skipped", score: 0, best: null, teams: [], products: 0, colorways: 0, reason: err.message };
  }
}
