// States and provinces as Shopify's analytics names them ("California",
// "Québec") or as codes ("TX", "US-TX"), turned into the region codes the
// postal areas carry (geo.ts). Shopify's UK addresses have no county, so GB
// has none: its customers spread over the whole country (shopify-counts.ts).
import type { Country } from "./geo";

const US_STATES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan",
  MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota",
  OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  PR: "Puerto Rico", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin",
  WY: "Wyoming",
};

const CA_PROVINCES: Record<string, string> = {
  AB: "Alberta", BC: "British Columbia", MB: "Manitoba", NB: "New Brunswick",
  NL: "Newfoundland and Labrador", NS: "Nova Scotia",
  NT: "Northwest Territories", NU: "Nunavut", ON: "Ontario",
  PE: "Prince Edward Island", QC: "Quebec", SK: "Saskatchewan", YT: "Yukon",
};

/** Other names people and stores use, French ones included. */
const ALIASES: Partial<Record<Country, Record<string, string>>> = {
  US: { "Washington DC": "DC", "Washington D.C.": "DC", "D.C.": "DC", "Hawai'i": "HI" },
  CA: {
    Newfoundland: "NL", "Newfoundland & Labrador": "NL", "Terre-Neuve-et-Labrador": "NL",
    "Colombie-Britannique": "BC", "Nouveau-Brunswick": "NB", "Nouvelle-Écosse": "NS",
    "Territoires du Nord-Ouest": "NT", "Île-du-Prince-Édouard": "PE", PEI: "PE",
    "Yukon Territory": "YT",
  },
};

/** "Québec" -> "quebec", "Washington, D.C." -> "washington d c". */
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function table(names: Record<string, string>, aliases: Record<string, string> = {}): Map<string, string> {
  const t = new Map<string, string>();
  for (const [code, name] of Object.entries(names)) {
    t.set(norm(code), code);
    t.set(norm(name), code);
  }
  for (const [alias, code] of Object.entries(aliases)) t.set(norm(alias), code);
  return t;
}

const TABLES: Partial<Record<Country, Map<string, string>>> = {
  US: table(US_STATES, ALIASES.US),
  CA: table(CA_PROVINCES, ALIASES.CA),
};

/** The region code for a state or province name or code, or null when
 *  there isn't one (any UK value, an empty one, "Armed Forces Europe"). */
export function regionCode(country: Country, raw: string | null | undefined): string | null {
  const t = TABLES[country];
  if (!t || !raw) return null;
  const key = norm(raw);
  // "US-TX", "CA-ON".
  const prefix = `${country.toLowerCase()} `;
  if (key.startsWith(prefix) && t.has(key.slice(prefix.length))) return t.get(key.slice(prefix.length))!;
  return t.get(key) ?? null;
}
