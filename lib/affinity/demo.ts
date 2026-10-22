// A sample brand for walkoff.io/upload/demo: a Southern California
// athleisure brand with no sports license. Its customers follow the US
// population, plus extra in San Diego, Orange County and LA, and its
// catalog is colorways with names like "Azure Heather" and "Sunflower".
import type { AreaCount, ProductCount, TaggedProduct } from "./compute";
import { hexForColorName } from "./colors";
import { POSTAL_AREAS } from "./geo";

const BOOST: Record<string, number> = {
  // San Diego
  "919": 3.0, "920": 3.0, "921": 3.0,
  // Orange County
  "926": 2.1, "927": 2.1, "928": 2.1,
  // Los Angeles
  "900": 1.5, "902": 1.5, "903": 1.5, "904": 1.5, "905": 1.5, "906": 1.5, "907": 1.5, "908": 1.5,
  "910": 1.5, "911": 1.5, "912": 1.5, "913": 1.5, "914": 1.5, "915": 1.5, "916": 1.5, "917": 1.5, "918": 1.5,
};

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
    const boost = BOOST[a.code] ?? 1;
    const customers = Math.round(((total * a.population) / population) * boost);
    if (!customers) continue;
    areas.push({ country: "US", area: a.code, customers, orders: Math.round(customers * 1.6), revenue: customers * 142 });
    // Shorts sell year round where it's warm.
    const warm = boost > 1;
    products.push(
      { country: "US", area: a.code, product: "Everyday Jogger", orders: Math.round(customers * 0.5) },
      { country: "US", area: a.code, product: "Sunday Hoodie", orders: Math.round(customers * (warm ? 0.25 : 0.4)) },
      { country: "US", area: a.code, product: "Performance Tee", orders: Math.round(customers * 0.3) },
      { country: "US", area: a.code, product: "Trail Short", orders: Math.round(customers * (warm ? 0.45 : 0.12)) },
    );
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
