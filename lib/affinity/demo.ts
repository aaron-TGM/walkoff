// A sample brand for walkoff.io/upload/demo: customers spread like the US
// population, with extra fans in Philadelphia, Wisconsin and Texas, like a
// drinkware brand that sells team-color koozies.
import type { AreaCount, ProductCount, TaggedProduct } from "./compute";
import { POSTAL_AREAS } from "./geo";

const BOOST: Record<string, number> = {
  "189": 2.6, "190": 2.6, "191": 2.6, "193": 2.6, "194": 2.6, "080": 2.6, "081": 2.6,
  "530": 2.2, "531": 2.2, "532": 2.2, "534": 2.2, "535": 2.2, "537": 2.2, "541": 2.2, "542": 2.2, "543": 2.2, "549": 2.2,
  "750": 1.6, "751": 1.6, "752": 1.6, "760": 1.6, "761": 1.6, "770": 1.6, "773": 1.6, "774": 1.6, "775": 1.6,
};

export const DEMO_BRAND = "Sample Drinkware Co.";

export function demoData(total = 16_000): { areas: AreaCount[]; products: ProductCount[]; catalog: TaggedProduct[] } {
  const us = POSTAL_AREAS.filter((a) => a.country === "US");
  const population = us.reduce((s, a) => s + a.population, 0);
  const areas: AreaCount[] = [];
  const products: ProductCount[] = [];
  for (const a of us) {
    const customers = Math.round(((total * a.population) / population) * (BOOST[a.code] ?? 1));
    if (!customers) continue;
    areas.push({ country: "US", area: a.code, customers, orders: Math.round(customers * 1.4), revenue: customers * 38 });
    const inPhilly = BOOST[a.code] === 2.6;
    const inWisconsin = BOOST[a.code] === 2.2;
    products.push(
      { country: "US", area: a.code, product: "Classic Can Koozie", orders: Math.round(customers * 0.5) },
      { country: "US", area: a.code, product: "Midnight Green Tumbler", orders: Math.round(customers * (inPhilly ? 0.45 : 0.08)) },
      { country: "US", area: a.code, product: "Cheese Wedge Koozie", orders: Math.round(customers * (inWisconsin ? 0.4 : 0.05)) },
      { country: "US", area: a.code, product: "Insulated Growler", orders: Math.round(customers * 0.2) },
    );
  }
  const catalog: TaggedProduct[] = [
    { title: "Bird Gang Koozie", teams: [{ league: "nfl", teamId: "21" }] },
    { title: "Lambeau Tumbler", teams: [{ league: "nfl", teamId: "9" }] },
  ];
  return { areas, products, catalog };
}
