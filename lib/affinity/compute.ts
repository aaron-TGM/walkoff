// A brand's affinity map: which fan territories hold more of its customers
// than population alone predicts, and which products those fans buy.
import { LEAGUES } from "../leagues";
import { postalArea, type Country, type TeamHome } from "./geo";
import { pickForTeam, type Pick, type PickProduct } from "./pick";
import { LEAGUE_COUNTRIES, territory } from "./territories";

/** Customers per postal area. What a brand uploads (counts, never people). */
export interface AreaCount {
  country: Country;
  area: string;
  customers: number;
  orders?: number;
  revenue?: number;
}

/** Orders of one product per postal area, from an order export. */
export interface ProductCount {
  country: Country;
  area: string;
  product: string;
  orders: number;
  revenue?: number;
}

/** A catalog product with its team tags and colorways (lib/affinity/tagging,
 *  lib/affinity/colors). */
export type TaggedProduct = PickProduct;

export interface ProductLift {
  product: string;
  /** How much more this territory's customers buy it than everyone else. */
  lift: number;
  orders: number;
}

export interface TeamGroup {
  league: string;
  leagueName: string;
  teamId: string;
  teamName: string;
  abbr: string;
  /** Estimated customers in the territory (fractional areas add up). */
  customers: number;
  /** Share of the brand's customers in the league's countries. */
  share: number;
  /** Share of the population in the same countries. */
  populationShare: number;
  /** share / populationShare: 2.4 means 2.4 times what population predicts. */
  lift: number;
  /** Standard score of the difference; above ~2.5 it isn't chance. */
  z: number;
  products: ProductLift[];
  taggedProducts: string[];
  /** The team's colors as hex, main color first. */
  colors?: string[];
  /** What to feature when they win (standouts only). */
  picks?: Pick[];
}

export interface LeagueSummary {
  league: string;
  leagueName: string;
  /** Brand customers in the league's countries. */
  customers: number;
  /** Biggest territories by customers. */
  teams: TeamGroup[];
}

export interface AffinityReport {
  version: 1;
  computedAt: string;
  totals: {
    customers: number;
    matchedCustomers: number;
    unmatchedCustomers: number;
    areas: number;
    byCountry: Partial<Record<Country, number>>;
    /** Product orders the map could use (0 without an order export). */
    productOrders: number;
  };
  /** Territories that clearly over-index, biggest excess first. */
  standouts: TeamGroup[];
  leagues: LeagueSummary[];
}

export const STANDOUT = { minLift: 1.25, minZ: 2.5, minCustomers: 15, max: 12 } as const;
/** What a territory "buys more of": enough orders, a clear lift, a few products. */
export const PRODUCT = { minOrders: 3, minLift: 1.15, max: 3 } as const;

function round(n: number, places: number): number {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

export function computeAffinity(
  counts: AreaCount[],
  options: { products?: ProductCount[]; catalog?: TaggedProduct[]; leagues?: string[]; now?: Date } = {},
): AffinityReport {
  const leagues = options.leagues ?? LEAGUES.map((l) => l.id);
  const totals: AffinityReport["totals"] = {
    customers: 0,
    matchedCustomers: 0,
    unmatchedCustomers: 0,
    areas: 0,
    byCountry: {},
    productOrders: 0,
  };

  // Merge duplicate rows and drop areas we can't place.
  const byArea = new Map<string, number>();
  for (const c of counts) {
    const n = Math.max(0, Number(c.customers) || 0);
    totals.customers += n;
    const area = postalArea(c.country, c.area);
    if (!area || n === 0) {
      totals.unmatchedCustomers += n;
      continue;
    }
    totals.matchedCustomers += n;
    totals.byCountry[c.country] = (totals.byCountry[c.country] ?? 0) + n;
    byArea.set(area.key, (byArea.get(area.key) ?? 0) + n);
  }
  totals.areas = byArea.size;

  // Product orders by area, for "what this territory buys".
  const productOrders = new Map<string, Map<string, number>>();
  for (const p of options.products ?? []) {
    const area = postalArea(p.country, p.area);
    if (!area || !(p.orders > 0)) continue;
    totals.productOrders += p.orders;
    const m = productOrders.get(area.key) ?? new Map<string, number>();
    m.set(p.product, (m.get(p.product) ?? 0) + p.orders);
    productOrders.set(area.key, m);
  }

  const tagged = new Map<string, string[]>();
  for (const p of options.catalog ?? []) {
    for (const t of p.teams) {
      const key = `${t.league}:${t.teamId}`;
      tagged.set(key, [...(tagged.get(key) ?? []), p.title]);
    }
  }

  const standouts: TeamGroup[] = [];
  const summaries: LeagueSummary[] = [];

  for (const league of leagues) {
    const countries = LEAGUE_COUNTRIES[league];
    if (!countries) continue;
    const t = territory(league);
    const leagueName = LEAGUES.find((l) => l.id === league)?.name ?? league;

    let n = 0;
    const observed = new Map<string, number>();
    const teamById = new Map<string, TeamHome>();
    const productsInTeam = new Map<string, Map<string, number>>();
    const productsAll = new Map<string, number>();
    let ordersAll = 0;

    for (const [key, customers] of byArea) {
      const shares = t.byArea.get(key);
      if (!shares) continue; // not one of this league's countries
      n += customers;
      const orders = productOrders.get(key);
      if (orders) {
        for (const [product, o] of orders) {
          productsAll.set(product, (productsAll.get(product) ?? 0) + o);
          ordersAll += o;
        }
      }
      for (const s of shares) {
        observed.set(s.team.id, (observed.get(s.team.id) ?? 0) + customers * s.share);
        teamById.set(s.team.id, s.team);
        if (orders) {
          const m = productsInTeam.get(s.team.id) ?? new Map<string, number>();
          for (const [product, o] of orders) m.set(product, (m.get(product) ?? 0) + o * s.share);
          productsInTeam.set(s.team.id, m);
        }
      }
    }
    if (n === 0) continue;

    const groups: TeamGroup[] = [];
    for (const [teamId, o] of observed) {
      const p = t.populationShare.get(teamId) ?? 0;
      if (p <= 0) continue;
      const expected = n * p;
      const lift = o / expected;
      const z = (o - expected) / Math.sqrt(expected * (1 - p));
      const team = teamById.get(teamId)!;

      const products: ProductLift[] = [];
      const inTeam = productsInTeam.get(teamId);
      if (inTeam && ordersAll > 0) {
        const teamOrders = [...inTeam.values()].reduce((s, x) => s + x, 0);
        for (const [product, orders] of inTeam) {
          if (orders < PRODUCT.minOrders || teamOrders === 0) continue;
          const productLift = orders / teamOrders / ((productsAll.get(product) ?? 0) / ordersAll);
          if (productLift >= PRODUCT.minLift) {
            products.push({ product, lift: round(productLift, 2), orders: Math.round(orders) });
          }
        }
        products.sort((a, b) => b.lift * Math.sqrt(b.orders) - a.lift * Math.sqrt(a.orders));
        products.splice(PRODUCT.max);
      }

      groups.push({
        league,
        leagueName,
        teamId,
        teamName: team.name,
        abbr: team.abbr,
        customers: Math.round(o),
        share: round(o / n, 4),
        populationShare: round(p, 4),
        lift: round(lift, 2),
        z: round(z, 1),
        products,
        taggedProducts: (tagged.get(`${league}:${teamId}`) ?? []).slice(0, 5),
        colors: team.colors,
      });
    }

    groups.sort((a, b) => b.customers - a.customers);
    summaries.push({ league, leagueName, customers: Math.round(n), teams: groups.slice(0, 5) });
    for (const g of groups) {
      if (g.lift >= STANDOUT.minLift && g.z >= STANDOUT.minZ && g.customers >= STANDOUT.minCustomers) {
        standouts.push(g);
      }
    }
  }

  // Extra customers, weighted by how strong the lift is: a big territory
  // at 1.3x shouldn't bury a striking one at 2.5x.
  const score = (g: TeamGroup) => g.customers * (1 - 1 / g.lift) * Math.log(g.lift);
  standouts.sort((a, b) => score(b) - score(a));
  const top = standouts.slice(0, STANDOUT.max);
  for (const g of top) g.picks = pickForTeam(options.catalog ?? [], g.league, { id: g.teamId, colors: g.colors ?? [] });

  return {
    version: 1,
    computedAt: (options.now ?? new Date()).toISOString(),
    totals,
    standouts: top,
    leagues: summaries,
  };
}
