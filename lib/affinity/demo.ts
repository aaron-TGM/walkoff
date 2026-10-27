// A sample brand for walkoff.io/upload/demo: a Southern California
// athleisure brand with no sports license. Its customers follow the US
// population, plus extra in San Diego, Orange County and LA, and in
// Wisconsin, a long way from home: the kind of thing a map shows a brand on
// day one. Each place buys a little more of one thing, and the catalog is
// colorways with names like "Azure Heather" and "Sunflower".
import type { AreaCount, ProductCount, TaggedProduct } from "./compute";
import { hexForColorName } from "./colors";
import { POSTAL_AREAS } from "./geo";

/** Where the customers bunch (3-digit ZIPs), how much, and what they buy
 *  more of there. */
const REGIONS: { boost: number; leans: string; areas: string[] }[] = [
  // San Diego
  { boost: 3.0, leans: "Trail Short", areas: ["919", "920", "921"] },
  // Orange County
  { boost: 2.1, leans: "Performance Tee", areas: ["926", "927", "928"] },
  // Los Angeles
  {
    boost: 1.5,
    leans: "Everyday Jogger",
    areas: ["900", "902", "903", "904", "905", "906", "907", "908", "910", "911", "912", "913", "914", "915", "916", "917", "918"],
  },
  // Wisconsin
  {
    boost: 2.0,
    leans: "Sunday Hoodie",
    areas: ["530", "531", "532", "534", "535", "537", "538", "539", "540", "541", "542", "543", "544", "545", "546", "547", "548", "549"],
  },
];

const REGION = new Map(REGIONS.flatMap((r) => r.areas.map((area) => [area, r] as const)));

/** Orders per customer everywhere, before a place's lean adds to one. */
const MIX: Record<string, number> = { "Everyday Jogger": 0.4, "Sunday Hoodie": 0.3, "Performance Tee": 0.3, "Trail Short": 0.2 };
const LEAN = 0.5;

export const DEMO_BRAND = "Sample Athleisure Co.";

const CATALOG: { title: string; code: string; colors: string[]; uses: string[] }[] = [
  { title: "Everyday Jogger", code: "EJ", colors: ["Azure Heather", "Midnight", "Heather Grey", "Black"], uses: [] },
  { title: "Sunday Hoodie", code: "SH", colors: ["Sunflower", "Dune", "Black", "Pine"], uses: ["cold_weather"] },
  { title: "Performance Tee", code: "PT", colors: ["Royal", "Salt", "Marigold", "Charcoal"], uses: ["game_day"] },
  { title: "Trail Short", code: "TS", colors: ["Bluebird", "Sage", "Black", "Sunset"], uses: ["summer"] },
  { title: "Weekend Quarter-Zip", code: "QZ", colors: ["Navy", "Oatmeal", "Burgundy", "Cobalt"], uses: ["cold_weather"] },
  { title: "Coastal Crew", code: "CC", colors: ["Violet", "Bone", "Kelly", "Gold"], uses: [] },
];

export function demoData(total = 16_000): { areas: AreaCount[]; products: ProductCount[]; catalog: TaggedProduct[] } {
  const us = POSTAL_AREAS.filter((a) => a.country === "US");
  const population = us.reduce((s, a) => s + a.population, 0);
  const areas: AreaCount[] = [];
  const products: ProductCount[] = [];
  for (const a of us) {
    const region = REGION.get(a.code);
    const customers = Math.round(((total * a.population) / population) * (region?.boost ?? 1));
    if (!customers) continue;
    areas.push({ country: "US", area: a.code, customers, orders: Math.round(customers * 1.6), revenue: customers * 142 });
    for (const [product, rate] of Object.entries(MIX)) {
      const orders = Math.round(customers * (rate + (region?.leans === product ? LEAN : 0)));
      products.push({ country: "US", area: a.code, product, orders });
    }
  }
  const catalog: TaggedProduct[] = CATALOG.map((p) => ({
    handle: p.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    title: p.title,
    teams: [],
    uses: p.uses,
    colorways: p.colors.map((name) => ({
      name,
      hex: hexForColorName(name),
      skus: [`${p.code}-${name.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase()}`],
      image: "",
    })),
  }));
  return { areas, products, catalog };
}
