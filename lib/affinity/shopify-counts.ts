// Customer counts from Shopify's analytics, for brands set up in Claude.
// Claude runs Walkoff's two ShopifyQL queries with the brand's Shopify
// connector and passes the rows to import_customer_counts (lib/mcp/tools.ts):
// customers by postal code (the top 1,000), and customers by state or
// province. Walkoff cuts each postal code to its area, spreads each state's
// other customers over its areas by population, and keeps only areas and
// counts. Rows that look like they carry an email or an address are refused.
import type { AreaCount } from "./compute";
import { COUNTRIES, normalizeCountry, POSTAL_AREAS, postalArea, toPostalArea, type Country, type PostalArea } from "./geo";
import type { CustomerImport } from "./imports";
import { regionCode } from "./regions";
import { parseCustomerUpload, UploadError } from "./validate";

/** The Shopify connector's tool that runs ShopifyQL. Read-only. */
export const SHOPIFY_TOOLS = { analytics: "run-analytics-query" } as const;

/** One source for Walkoff's instructions, its setup prompt and the help
 *  center. Both count customers with a postal code in the last year, so the
 *  second query's totals cover the same customers the first one draws from. */
export const SHOPIFYQL = {
  postalCodes:
    "FROM sales SHOW customers WHERE shipping_country_code IN ('US', 'CA', 'GB') AND shipping_postal_code IS NOT NULL GROUP BY shipping_country_code, shipping_postal_code SINCE -365d UNTIL today ORDER BY customers DESC LIMIT 1000",
  regions:
    "FROM sales SHOW customers WHERE shipping_country_code IN ('US', 'CA', 'GB') AND shipping_postal_code IS NOT NULL GROUP BY shipping_country_code, shipping_region SINCE -365d UNTIL today ORDER BY customers DESC LIMIT 1000",
} as const;

export const COUNT_LIMITS = {
  /** Rows the first query returns. Fewer, and the map leans on spreading. */
  postalRows: 1_000,
  /** Most rows either input takes. */
  lines: 5_000,
  fieldChars: 60,
  perLine: 10_000_000,
} as const;

export interface CountLine {
  country: string;
  /** A postal code, or a state or province. */
  key: string;
  customers: number;
}

type Input = "postal" | "region";

const ROW: Record<Input, { name: string; parts: string; example: string }> = {
  postal: { name: "postal_codes", parts: "country, postal code and customers", example: "US,92101,37" },
  region: { name: "regions", parts: "country, state or province, and customers", example: "US,California,1204" },
};

function fail(message: string): never {
  throw new UploadError(message);
}

function csvFields(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch !== '"') cur += ch;
      else if (line[i + 1] === '"') cur += line[++i];
      else quoted = false;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

/** A row as commas, tabs or a table's pipes, trimmed and unquoted. */
function fields(line: string): string[] {
  const table = line.includes("|");
  const comma = !table && !line.includes("\t");
  let f = (table ? line.replace(/^\|/, "").replace(/\|$/, "").split("|") : comma ? csvFields(line) : line.split("\t")).map((x) =>
    x.trim().replace(/^["'`*]+|["'`*]+$/g, "").trim(),
  );
  while (f.length > 3 && f[f.length - 1] === "") f.pop();
  // An unquoted "1,204" splits in two.
  if (comma && f.length > 3 && /^\d{1,3}(,\d{3})+$/.test(f.slice(2).join(","))) f = [f[0], f[1], f.slice(2).join(",")];
  return f;
}

/** "37", "1,204", "37.0". Null for anything else. */
function parseCount(raw: string): number | null {
  const s = /^\d{1,3}(,\d{3})+$/.test(raw) ? raw.replace(/,/g, "") : raw;
  if (!/^\d+(\.0+)?$/.test(s)) return null;
  const n = Number(s);
  return n <= COUNT_LIMITS.perLine ? n : null;
}

/** Rows of country, key and customers, as a query returns them: a header,
 *  commas, tabs, quotes or a table are fine. Throws an UploadError on
 *  anything that looks like more than counts. Never echoes a row. */
export function parseCountLines(text: string, input: Input): { lines: CountLine[]; unreadable: number } {
  const row = ROW[input];
  const hint = `Each row takes three parts: ${row.parts}, like ${row.example}.`;
  if (text.includes("@")) fail("Those rows include an email address. Walkoff takes counts only, never names, emails or addresses.");
  const raw = text.split(/\r?\n/);
  if (raw.filter((l) => l.trim()).length > COUNT_LIMITS.lines) {
    fail(`${row.name} has more than ${COUNT_LIMITS.lines.toLocaleString("en-US")} rows. Walkoff's queries return at most ${COUNT_LIMITS.postalRows.toLocaleString("en-US")}.`);
  }
  const lines: CountLine[] = [];
  let unreadable = 0;
  let started = false;
  raw.forEach((rawLine, i) => {
    const line = rawLine.trim();
    if (!line) return;
    const f = fields(line);
    if (f.every((x) => x === "" || /^:?-{2,}:?$/.test(x))) return; // a table's rule
    if (f.length > 3) fail(`Line ${i + 1} of ${row.name} has more than three parts. ${hint}`);
    if (f.some((x) => x.length > COUNT_LIMITS.fieldChars)) fail(`Line ${i + 1} of ${row.name} is too long. ${hint}`);
    const customers = f.length >= 2 ? parseCount(f[f.length - 1]) : null;
    // Rows before the first count are headers.
    if (customers === null) {
      if (started) unreadable++;
      return;
    }
    started = true;
    // Two parts is a row with no key, like a UK row with no region.
    if (customers > 0) lines.push({ country: f[0], key: f.length === 3 ? f[1] : "", customers });
  });
  if (!lines.length) fail(`Walkoff couldn't read any rows in ${row.name}. ${hint}`);
  return { lines, unreadable };
}

const DISTRICT = /^[A-Z]{1,2}\d[A-Z\d]?$/;
const FULL: Record<Country, RegExp> = {
  // Four digits is a ZIP that lost its leading zero in a spreadsheet.
  US: /^(\d{4}|\d{5}(-?\d{4})?)$/,
  CA: /^[A-Z]\d[A-Z](\d[A-Z]\d)?$/,
  GB: /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/,
};

/** The area Walkoff keeps for a postal code, if it maps it. A code that's
 *  already an area stays as is: "921" is San Diego, not 00921. */
export function coarseArea(country: Country, raw: string): string | null {
  const code = raw.trim().toUpperCase();
  const compact = code.replace(/\s+/g, "");
  let area: string | null = null;
  if (country === "US" && /^\d{3}$/.test(compact)) area = compact;
  else if (country === "GB" && DISTRICT.test(compact)) area = compact;
  else if (FULL[country].test(compact)) area = toPostalArea(code, country)?.code ?? null;
  return area && postalArea(country, area) ? area : null;
}

/** Splits a whole number in proportion to weights, in whole numbers that
 *  add up to it exactly: each share rounded down, then one more for the
 *  largest remainders. Ties go to the larger weight, then the earlier one.
 *  All weights 0 means equal shares. */
export function apportion(total: number, weights: number[]): number[] {
  if (!weights.length || total <= 0) return weights.map(() => 0);
  const w = weights.some((x) => x > 0) ? weights.map((x) => Math.max(0, x)) : weights.map(() => 1);
  const sum = w.reduce((s, x) => s + x, 0);
  const quotas = w.map((x) => (total * x) / sum);
  const out = quotas.map(Math.floor);
  const left = total - out.reduce((s, x) => s + x, 0);
  const order = w.map((_, i) => i).sort((a, b) => quotas[b] - out[b] - (quotas[a] - out[a]) || w[b] - w[a] || a - b);
  for (let k = 0; k < left; k++) out[order[k % order.length]]++;
  return out;
}

const BY_COUNTRY = new Map<Country, PostalArea[]>(COUNTRIES.map((c) => [c, POSTAL_AREAS.filter((a) => a.country === c)]));
const BY_REGION = new Map<string, PostalArea[]>();
for (const a of POSTAL_AREAS) {
  const key = `${a.country}:${a.region}`;
  const areas = BY_REGION.get(key);
  if (areas) areas.push(a);
  else BY_REGION.set(key, [a]);
}

export interface AreaBuild {
  areas: AreaCount[];
  /** Customers placed by their own postal code. */
  fromPostalCodes: number;
  /** Customers outside the top codes, spread over their state's or
   *  province's areas by population. */
  spreadByRegion: number;
  /** Customers spread over their whole country by population: the UK, and
   *  states Walkoff couldn't name. */
  spreadCountryWide: number;
  customers: number;
  byCountry: Partial<Record<Country, number>>;
  /** The second query's total, or null without it. */
  regionTotal: number | null;
  /** The share of customers placed by their own postal code. Null without
   *  the second query, since then nobody knows how many are missing. */
  coverage: number | null;
  /** Customers the postal codes counted twice: someone who shipped to two
   *  codes counts in each, so a state's codes can add up to more than its
   *  total. */
  overCounted: number;
  /** Rows Walkoff couldn't place. */
  skipped: { otherCountries: number; unknownAreas: number };
  /** State and province names that matched nothing, at most 10. */
  regionsNotMatched: string[];
}

/** The country and key, swapped if they came the other way round. */
function countryOf(line: CountLine): { country: Country | null; key: string } {
  const country = normalizeCountry(line.country);
  if (!country && line.key && normalizeCountry(line.key)) return { country: normalizeCountry(line.key), key: line.country };
  return { country, key: line.key };
}

/** Customers per area from the two queries' rows. */
export function buildAreaCounts(input: { postal: CountLine[]; regions?: CountLine[] }): AreaBuild {
  const skipped = { otherCountries: 0, unknownAreas: 0 };
  const placed = new Map<string, number>();
  let fromPostalCodes = 0;
  for (const line of input.postal) {
    const { country, key } = countryOf(line);
    if (!country) {
      skipped.otherCountries++;
      continue;
    }
    const area = coarseArea(country, key);
    if (!area) {
      skipped.unknownAreas++;
      continue;
    }
    placed.set(`${country}:${area}`, (placed.get(`${country}:${area}`) ?? 0) + line.customers);
    fromPostalCodes += line.customers;
  }

  const spread = new Map<string, number>();
  const spreadOver = (areas: PostalArea[], n: number) =>
    apportion(n, areas.map((a) => a.population)).forEach((share, i) => {
      if (share) spread.set(areas[i].key, (spread.get(areas[i].key) ?? 0) + share);
    });
  const placedIn = (areas: PostalArea[]) => areas.reduce((s, a) => s + (placed.get(a.key) ?? 0), 0);
  let spreadByRegion = 0;
  let spreadCountryWide = 0;
  let overCounted = 0;
  let regionTotal: number | null = null;
  const notMatched = new Set<string>();

  if (input.regions) {
    regionTotal = 0;
    const totals = new Map<Country, { matched: Map<string, number>; pool: number }>();
    for (const line of input.regions) {
      const { country, key } = countryOf(line);
      if (!country) {
        skipped.otherCountries++;
        continue;
      }
      regionTotal += line.customers;
      const t = totals.get(country) ?? { matched: new Map<string, number>(), pool: 0 };
      totals.set(country, t);
      const code = regionCode(country, key);
      if (code && BY_REGION.has(`${country}:${code}`)) {
        t.matched.set(code, (t.matched.get(code) ?? 0) + line.customers);
        continue;
      }
      t.pool += line.customers;
      if (country !== "GB" && /^[\p{L}][\p{L} .'-]{0,39}$/u.test(key) && notMatched.size < 10) notMatched.add(key);
    }
    for (const [country, t] of totals) {
      for (const [region, total] of t.matched) {
        const areas = BY_REGION.get(`${country}:${region}`)!;
        const rest = total - placedIn(areas);
        if (rest < 0) overCounted -= rest;
        else if (rest > 0) {
          spreadOver(areas, rest);
          spreadByRegion += rest;
        }
      }
      if (t.pool > 0) {
        // Net of the customers already placed in regions the pool may hold,
        // so an unmatched "Washington DC" doesn't count DC twice; spread
        // country-wide, so 12 overseas military customers don't become a
        // cluster in the one unmatched state.
        const all = BY_COUNTRY.get(country)!;
        const rest = t.pool - placedIn(all.filter((a) => !t.matched.has(a.region)));
        if (rest < 0) overCounted -= rest;
        else if (rest > 0) {
          spreadOver(all, rest);
          spreadCountryWide += rest;
        }
      }
    }
  }

  const byCountry: Partial<Record<Country, number>> = {};
  const areas: AreaCount[] = [];
  for (const a of POSTAL_AREAS) {
    const customers = (placed.get(a.key) ?? 0) + (spread.get(a.key) ?? 0);
    if (!customers) continue;
    areas.push({ country: a.country, area: a.code, customers, orders: 0, revenue: 0 });
    byCountry[a.country] = (byCountry[a.country] ?? 0) + customers;
  }
  areas.sort((a, b) => b.customers - a.customers);
  const customers = fromPostalCodes + spreadByRegion + spreadCountryWide;
  return {
    areas,
    fromPostalCodes,
    spreadByRegion,
    spreadCountryWide,
    customers,
    byCountry,
    regionTotal,
    coverage: regionTotal === null || !customers ? null : Math.round((fromPostalCodes / customers) * 100) / 100,
    overCounted,
    skipped,
    regionsNotMatched: [...notMatched],
  };
}

export interface CountsImport {
  upload: CustomerImport;
  build: AreaBuild;
  /** Rows after a header that couldn't be read. */
  unreadable: number;
  /** For Claude, when the map leans on spreading more than it should. */
  notes: string[];
}

const digits = (lines: CountLine[]) => lines.filter((l) => /\d/.test(l.key)).length;

/** The two queries' rows as an upload of counts, checked the way the upload
 *  API checks a file's: only coarse areas. Throws an UploadError. */
export function customerCountsImport(raw: { postalCodes: string; regions?: string }): CountsImport {
  const postal = parseCountLines(raw.postalCodes, "postal");
  const regions = raw.regions?.trim() ? parseCountLines(raw.regions, "region") : undefined;
  const keyed = postal.lines.filter((l) => l.key);
  const swapped = "The rows look swapped. postal_codes takes the first query's rows (country, postal code, customers) and regions takes the second's (country, state or province, customers).";
  if (keyed.length && digits(keyed) < keyed.length / 2) fail(swapped);
  if (regions && digits(regions.lines) > regions.lines.length / 2) fail(swapped);

  const build = buildAreaCounts({ postal: postal.lines, regions: regions?.lines });
  if (!build.fromPostalCodes) fail("None of these postal codes are in an area Walkoff maps. It maps the US, Canada and the UK.");
  const notes: string[] = [];
  if (!regions) {
    notes.push("Without the second query's state and province totals, the map has only the top postal codes. Run it too and pass its rows as regions.");
  } else if (postal.lines.length < COUNT_LIMITS.postalRows && build.coverage !== null && build.coverage < 0.9) {
    notes.push(
      `Only ${postal.lines.length} postal code rows came through, for ${Math.round(build.coverage * 100)}% of customers. If the first query returned more, pass all of them in one call.`,
    );
  }
  const unreadable = postal.unreadable + (regions?.unreadable ?? 0);
  const rows = postal.lines.length + (regions?.lines.length ?? 0);
  const upload = parseCustomerUpload({
    format: "counts_csv",
    rows,
    skipped: build.skipped.otherCountries + build.skipped.unknownAreas + unreadable,
    areas: build.areas,
    products: [],
  });
  return { upload, build, unreadable, notes };
}
