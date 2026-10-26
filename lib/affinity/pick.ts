// What to feature when a team wins. Products made for the team come first.
// Otherwise it's the colorways closest to the team's colors: no logo or
// license needed, just a real reason to show up in that moment.
import { colorFamily, colorMatch, familyHex, teamPalette } from "./colors";

export interface PickColorway {
  name: string;
  hex: string[];
  skus: string[];
  image: string;
}

export interface PickProduct {
  handle?: string;
  title: string;
  teams: { league: string; teamId: string }[];
  colorways?: PickColorway[];
  /** Colors named in the title or description, for products without
   *  colorways. */
  colors?: string[];
  uses?: string[];
  /** Scenes it's made for beyond team sports: surf, golf, tennis. */
  interests?: string[];
  price?: number | null;
}

export interface Pick {
  handle?: string;
  title: string;
  /** The colorway to feature, when color earned the pick. */
  colorway: string | null;
  hex: string[];
  skus: string[];
  image: string;
  /** "Made for their fans", or "Close to their blue". */
  why: string;
  score: number;
  price?: number | null;
}

/** Below this a color is a stretch, not a nod. */
export const MIN_COLOR_MATCH = 0.5;

/** A product's color option, or a color from its title when it has no
 *  colorways (then it isn't a variant to name). */
type Option = PickColorway & { variant: boolean };

interface Match {
  product: PickProduct;
  option: Option;
  /** How well it matches each team color, by team hex. */
  byColor: Map<string, number>;
  /** Team colors it clearly wears. */
  worn: string[];
  score: number;
}

function optionsOf(product: PickProduct): Option[] {
  if (product.colorways?.length) return product.colorways.map((c) => ({ ...c, variant: true }));
  return (product.colors ?? []).flatMap((c) => {
    const hex = familyHex(c);
    return hex ? [{ name: c, hex: [hex], skus: [], image: "", variant: false }] : [];
  });
}

function toPick(product: PickProduct, option: Option | null, teamHex: string | null, score: number): Pick {
  return {
    handle: product.handle,
    title: product.title,
    colorway: option?.variant ? option.name : null,
    hex: option?.hex ?? [],
    skus: option?.skus ?? [],
    image: option?.image ?? "",
    why: teamHex ? `Close to their ${colorFamily(teamHex)}` : "Made for their fans",
    score: Math.round(score * 100) / 100,
    price: product.price ?? null,
  };
}

export function pickForTeam(
  products: PickProduct[],
  league: string,
  team: { id: string; colors: string[] },
  limit = 3,
): Pick[] {
  const palette = teamPalette(team.colors);
  const made: Pick[] = [];
  const matches: Match[] = [];
  for (const product of products) {
    const tagged = product.teams.some((t) => t.league === league && t.teamId === team.id);
    let best: Match | null = null;
    for (const option of optionsOf(product)) {
      const byColor = new Map(palette.map((t) => [t.hex, Math.max(0, ...option.hex.map((h) => t.weight * colorMatch(t.hex, h)))]));
      const worn = [...byColor].filter(([, m]) => m >= MIN_COLOR_MATCH).map(([hex]) => hex);
      // A two-tone colorway in both team colors ("Navy/Gold").
      const score =
        Math.max(0, ...byColor.values()) + (worn.length >= 2 ? 0.2 : 0) + (product.uses?.includes("game_day") ? 0.05 : 0);
      const match = { product, option, byColor, worn, score };
      if (!tagged && worn.length) matches.push(match);
      if (!best || score > best.score) best = match;
    }
    if (tagged) {
      const colored = best?.worn.length ? best : null;
      made.push(toPick(product, colored?.option ?? null, null, 2 + (best?.score ?? 0)));
    }
  }
  made.sort((a, b) => b.score - a.score);

  // One pick per team color, each from a different product where possible,
  // so a win shows the colors together. The color with the fewest options
  // chooses first; the main color still leads. Then the best of the rest,
  // one colorway per product.
  const wearing = new Map(
    palette.map((t) => [
      t.hex,
      matches.filter((m) => m.worn.includes(t.hex)).sort((a, b) => b.byColor.get(t.hex)! - a.byColor.get(t.hex)!),
    ]),
  );
  const order = palette
    .map((t, i) => ({ hex: t.hex, i, options: wearing.get(t.hex)!.length }))
    .filter((t) => t.options > 0)
    .sort((a, b) => a.options - b.options || a.i - b.i);
  const chosen: { i: number; pick: Pick }[] = [];
  const used = new Set<Match>();
  const usedProducts = new Set<PickProduct>();
  const covered = new Set<string>();
  for (const t of order) {
    if (covered.has(t.hex)) continue;
    const options = wearing.get(t.hex)!;
    const choice = options.find((m) => !usedProducts.has(m.product)) ?? options.find((m) => !used.has(m));
    if (!choice) continue;
    chosen.push({ i: t.i, pick: toPick(choice.product, choice.option, t.hex, choice.byColor.get(t.hex)!) });
    used.add(choice);
    usedProducts.add(choice.product);
    choice.worn.forEach((hex) => covered.add(hex));
  }
  const picks = chosen.sort((a, b) => a.i - b.i).map((c) => c.pick);
  for (const m of [...matches].sort((a, b) => b.score - a.score)) {
    if (used.has(m) || usedProducts.has(m.product)) continue;
    const teamHex = [...m.byColor].sort((a, b) => b[1] - a[1])[0][0];
    picks.push(toPick(m.product, m.option, teamHex, m.score));
    usedProducts.add(m.product);
  }
  return [...made, ...picks].slice(0, limit);
}

/** A product as a pick in its first colorway, for reasons other than color. */
export function plain(product: PickProduct, why: string, score = 0): Pick {
  const first = product.colorways?.[0];
  return {
    handle: product.handle,
    title: product.title,
    colorway: null,
    hex: first?.hex ?? [],
    skus: first?.skus ?? [],
    image: first?.image ?? "",
    why,
    score,
    price: product.price ?? null,
  };
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Products named for a town ("San Clemente Pier Tee"), for its hometown
 *  moments. */
export function pickForTown(products: PickProduct[], town: string, limit = 3): Pick[] {
  const named = new RegExp(`\\b${escapeRegExp(town)}\\b`, "i");
  return products.filter((p) => named.test(p.title)).slice(0, limit).map((p) => plain(p, `Named for ${town}`, 3));
}

/** Products made for a scene (golf, surf, tennis, motorsports), for an
 *  individual athlete's win. */
export function pickForInterest(products: PickProduct[], interest: string, limit = 3): Pick[] {
  return products.filter((p) => p.interests?.includes(interest)).slice(0, limit).map((p) => plain(p, `Made for ${interest}`, 1));
}
