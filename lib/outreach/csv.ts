// Reads the files outreach starts from: a Store Leads export, one row per
// store, and a contact export from Apollo, FullEnrich or Clay, one row per
// person. Store Leads doesn't publish its column names, so each field is
// found by the names exports give it, and every read reports which column
// each field came from. Multi-value cells (apps, categories) use Store
// Leads' separator, a colon unless the export changed it.
import Papa from "papaparse";
import { normalizeCountry } from "../affinity/geo";
import { regionCode } from "../affinity/regions";

export type Row = Record<string, string | undefined>;

const norm = (h: string) => h.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** A CSV file's rows and headers. Drops the byte-order mark Excel-friendly
 *  exports start with. */
export function readCsv(text: string): { headers: string[]; rows: Row[] } {
  const parsed = Papa.parse<Row>(text.replace(/^﻿/, ""), { header: true, skipEmptyLines: "greedy" });
  return { headers: parsed.meta.fields ?? [], rows: parsed.data };
}

type Fields<K extends string> = Record<K, string[]>;

/** For each field, the file's headers that can hold it, best name first. */
function columnsFor<K extends string>(headers: string[], fields: Fields<K>): Record<K, string[]> {
  const byName = new Map<string, string[]>();
  for (const h of headers) byName.set(norm(h), [...(byName.get(norm(h)) ?? []), h]);
  return Object.fromEntries(
    Object.entries<string[]>(fields).map(([field, names]) => [field, names.flatMap((n) => byName.get(n) ?? [])]),
  ) as Record<K, string[]>;
}

/** The first value in these columns that `accept` takes. */
function first<T>(row: Row, columns: string[], accept: (v: string) => T | null): T | null {
  for (const c of columns) {
    const v = row[c]?.trim();
    if (!v) continue;
    const out = accept(v);
    if (out !== null) return out;
  }
  return null;
}

const text = (max: number) => (v: string) => v.slice(0, max);

/** "frostbuddy.com" from "https://www.FrostBuddy.com/collections/all",
 *  or null for something that isn't a public host name. */
export function domainOf(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  if (!s || /\s/.test(s) || s.includes("@")) return null;
  let host: string;
  try {
    host = new URL(/^[a-z][a-z0-9+.-]*:\/\//.test(s) ? s : `https://${s}`).hostname;
  } catch {
    return null;
  }
  host = host.replace(/^www\./, "").replace(/\.$/, "");
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(host)) return null;
  return host.length <= 253 ? host : null;
}

/** "$1,234.50", "1234", "$1.2M" or "12.5K" as a number of dollars. */
export function amount(raw: string): number | null {
  const m = raw.replace(/[$,\s]|USD/gi, "").match(/^(-?\d+(?:\.\d+)?)([kmb])?$/i);
  if (!m) return null;
  const n = Number(m[1]) * ({ k: 1e3, m: 1e6, b: 1e9 }[m[2]?.toLowerCase() as "k" | "m" | "b"] ?? 1);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

function count(raw: string): number | null {
  const n = amount(raw);
  return n === null ? null : Math.round(n);
}

function coordinate(max: number) {
  return (raw: string) => {
    const n = Number(raw);
    return Number.isFinite(n) && Math.abs(n) <= max && raw.trim() !== "" ? n : null;
  };
}

function list(row: Row, columns: string[], separator: string, max: number): string[] {
  const out = new Set<string>();
  for (const c of columns) {
    for (const part of (row[c] ?? "").split(separator)) {
      const v = part.trim();
      if (v && out.size < max) out.add(v.slice(0, 120));
    }
  }
  return [...out];
}

// ── Store Leads ─────────────────────────────────────────────────────

const PROSPECT_FIELDS = {
  // The API calls the domain "name"; some exports do too.
  domain: ["domain", "domain name", "store domain", "website", "store url", "url", "company domain", "company website", "name"],
  name: ["merchant name", "merchant", "company name", "company", "store name", "brand name", "brand", "title", "name"],
  platform: ["platform", "ecommerce platform", "e commerce platform"],
  country: ["country code", "country", "hq country", "company country"],
  city: ["city", "hq city", "company city"],
  region: ["administrative area level 1", "state", "province", "state province", "state code", "hq state", "company state"],
  // Store Leads' "region" is a continent ("Americas"), so it counts only
  // when it names a state or province.
  region_fallback: ["region", "subregion"],
  postal_code: ["postal code", "zip", "zip code", "postcode", "post code", "hq postal code"],
  lat: ["latitude", "lat"],
  lng: ["longitude", "lng", "lon", "long"],
  monthly_sales: ["estimated monthly sales", "estimated sales", "monthly sales", "est monthly sales", "estimated sales monthly"],
  yearly_sales: ["estimated yearly sales", "estimated sales yearly", "estimated annual sales", "yearly sales", "annual sales"],
  product_count: ["product count", "products", "number of products", "products count", "total products"],
  categories: ["categories", "category", "industry", "industries", "vertical"],
  apps: ["apps", "installed apps", "shopify apps", "app names", "technologies", "technology", "tech"],
} satisfies Fields<string>;

export type ProspectField = keyof typeof PROSPECT_FIELDS;

export interface ProspectRow {
  domain: string;
  name: string | null;
  store_url: string;
  platform: string | null;
  country: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  lat: number | null;
  lng: number | null;
  monthly_sales: number | null;
  product_count: number | null;
  categories: string[];
  apps: string[];
}

export interface ReadReport {
  /** Each field and the columns it was read from; empty when the file has none. */
  columns: Record<string, string[]>;
  rows: number;
  /** Rows kept (duplicates of a domain merge into its first row). */
  kept: number;
  /** Rows dropped, by reason. */
  skipped: Record<string, number>;
}

function skip(report: ReadReport, reason: string) {
  report.skipped[reason] = (report.skipped[reason] ?? 0) + 1;
}

/** Stores from a Store Leads export (or any sheet with a domain column),
 *  one per domain. `columns` overrides where a field is read from:
 *  { region: "HQ State" }. */
export function parseProspects(
  headers: string[],
  rows: Row[],
  opts: { separator?: string; columns?: Partial<Record<ProspectField, string>> } = {},
): { prospects: ProspectRow[]; report: ReadReport } {
  const separator = opts.separator ?? ":";
  const cols = columnsFor(headers, PROSPECT_FIELDS);
  for (const [field, header] of Object.entries(opts.columns ?? {})) {
    if (!header) continue;
    if (!headers.includes(header)) throw new Error(`The file has no column named "${header}".`);
    cols[field as ProspectField] = [header];
  }
  const report: ReadReport = { columns: cols, rows: rows.length, kept: 0, skipped: {} };
  const byDomain = new Map<string, ProspectRow>();
  for (const row of rows) {
    const domain = first(row, cols.domain, domainOf);
    if (!domain) {
      skip(report, "no store address");
      continue;
    }
    const country = first(row, cols.country, (v) => normalizeCountry(v) ?? (/^[a-z]{2}$/i.test(v) ? v.toUpperCase() : v.slice(0, 60)));
    const covered = normalizeCountry(country);
    const region =
      first(row, cols.region, (v) => (covered ? regionCode(covered, v) : null) ?? v.slice(0, 60)) ??
      first(row, cols.region_fallback, (v) => (covered ? regionCode(covered, v) : null));
    const yearly = first(row, cols.yearly_sales, amount);
    const prospect: ProspectRow = {
      domain,
      name: first(row, cols.name, (v) => (domainOf(v) === domain ? null : v.slice(0, 120))),
      store_url: `https://${domain}`,
      platform: first(row, cols.platform, (v) => v.toLowerCase().slice(0, 40)),
      country,
      city: first(row, cols.city, text(80)),
      region,
      postal_code: first(row, cols.postal_code, text(12)),
      lat: first(row, cols.lat, coordinate(90)),
      lng: first(row, cols.lng, coordinate(180)),
      monthly_sales: first(row, cols.monthly_sales, amount) ?? (yearly === null ? null : Math.round((yearly / 12) * 100) / 100),
      product_count: first(row, cols.product_count, count),
      categories: list(row, cols.categories, separator, 20),
      apps: list(row, cols.apps, separator, 200),
    };
    const seen = byDomain.get(domain);
    if (seen) {
      skip(report, "same store twice");
      continue;
    }
    byDomain.set(domain, prospect);
  }
  report.kept = byDomain.size;
  return { prospects: [...byDomain.values()], report };
}

/** The email and SMS tools a store runs, from its apps: what Walkoff
 *  drafts into (Klaviyo) and what it's adding (Postscript, Attentive). */
export function messagingApps(apps: string[]): string[] {
  const names = ["Klaviyo", "Postscript", "Attentive", "Omnisend", "Mailchimp", "Shopify Email"];
  return names.filter((n) => apps.some((a) => a.toLowerCase().includes(n.toLowerCase())));
}

// ── Contacts ───────────────────────────────────────────────────────

const CONTACT_FIELDS = {
  email: ["email", "work email", "email address", "business email", "professional email", "verified email", "primary email", "person email"],
  email_status: ["email status", "work email status", "email verification", "verification status", "email confidence"],
  first_name: ["first name", "firstname", "given name"],
  last_name: ["last name", "lastname", "surname", "family name"],
  name: ["full name", "name", "contact name", "person name"],
  title: ["title", "job title", "position", "role", "headline"],
  linkedin: ["person linkedin url", "linkedin url", "linkedin", "linkedin profile", "linkedin profile url"],
  domain: ["company domain", "domain", "website", "company website", "company url", "website url", "organization domain", "account website"],
  company: ["company", "company name", "organization", "organization name", "account name", "company name for emails"],
} satisfies Fields<string>;

export interface ContactRow {
  email: string;
  /** The company's domain, to find its prospect; else its name. */
  domain: string | null;
  company: string | null;
  name: string | null;
  first_name: string | null;
  title: string | null;
  linkedin: string | null;
  email_status: string | null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** What lookup tools call an address that won't arrive. */
const UNDELIVERABLE = /invalid|unavailable|undeliverable|bounce|not found|no email/i;

/** People from a contact export, one per email address. */
export function parseContacts(headers: string[], rows: Row[]): { contacts: ContactRow[]; report: ReadReport } {
  const cols = columnsFor(headers, CONTACT_FIELDS);
  const report: ReadReport = { columns: cols, rows: rows.length, kept: 0, skipped: {} };
  const byEmail = new Map<string, ContactRow>();
  for (const row of rows) {
    const email = first(row, cols.email, (v) => (EMAIL.test(v) && v.length <= 254 ? v.toLowerCase() : null));
    if (!email) {
      skip(report, "no email address");
      continue;
    }
    const status = first(row, cols.email_status, text(40));
    if (status && UNDELIVERABLE.test(status)) {
      skip(report, "address marked undeliverable");
      continue;
    }
    if (byEmail.has(email)) {
      skip(report, "same person twice");
      continue;
    }
    const firstName = first(row, cols.first_name, text(60));
    const lastName = first(row, cols.last_name, text(60));
    const full = first(row, cols.name, text(120)) ?? ([firstName, lastName].filter(Boolean).join(" ") || null);
    byEmail.set(email, {
      email,
      domain: first(row, cols.domain, domainOf),
      company: first(row, cols.company, text(120)),
      name: full,
      first_name: firstName ?? full?.split(" ")[0] ?? null,
      title: first(row, cols.title, text(120)),
      linkedin: first(row, cols.linkedin, (v) => (/linkedin\.com\//i.test(v) ? v.slice(0, 200) : null)),
      email_status: status,
    });
  }
  report.kept = byEmail.size;
  return { contacts: [...byEmail.values()], report };
}

/** A contact's company domain, else the domain of a work address (not a
 *  Gmail or Outlook one). */
export function contactDomain(c: ContactRow): string | null {
  if (c.domain) return c.domain;
  const host = c.email.split("@")[1];
  return host && !FREE_MAIL.has(host) ? domainOf(host) : null;
}

const FREE_MAIL = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "msn.com", "yahoo.com", "icloud.com", "me.com",
  "aol.com", "proton.me", "protonmail.com", "gmx.com",
]);
