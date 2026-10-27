// Outreach in Supabase (supabase/012_outreach.sql): prospects, their
// contacts, each pitch and the addresses never to write to. The scripts
// read and write all of it with the service role key; the pitch page reads
// one pitch by its token and counts its views.
import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { contactDomain, type ContactRow, type ProspectRow } from "./csv";
import type { HomeTeam } from "./home";
import type { PitchPage } from "./pitch";
import type { ScoreResult, TeamScore } from "./score";

/** Rows per write, and values per lookup: an in() filter rides in the URL. */
const CHUNK = 200;
const LOOKUP = 100;

export const PROSPECT_STATUSES = ["new", "qualified", "skipped", "contacted", "replied", "trial", "customer", "lost"] as const;
export type ProspectStatus = (typeof PROSPECT_STATUSES)[number];

export const OUTREACH_STATUSES = ["drafted", "sent", "replied", "bounced", "unsubscribed"] as const;
export type OutreachStatus = (typeof OUTREACH_STATUSES)[number];

/** Statuses scoring may change: once someone's been written to, a new
 *  score doesn't move them back. */
const SCORABLE: ProspectStatus[] = ["new", "qualified", "skipped"];

export interface ScoreDetail {
  products: number;
  colorways: number;
  reason: string;
  note?: string;
  teams: TeamScore[];
}

export interface Prospect extends ProspectRow {
  id: string;
  source: string;
  home_area: string | null;
  home_teams: HomeTeam[];
  status: ProspectStatus;
  score: number | null;
  best_team: string | null;
  score_detail: ScoreDetail | null;
  scored_at: string | null;
  notes: string | null;
  created_at: string;
}

export type NewProspect = ProspectRow & { home_area: string | null; home_teams: HomeTeam[] };

/** A fresh value where the file has one, else what's saved: a later export
 *  with a blank cell doesn't erase what an earlier one said. */
function merge(saved: Partial<Prospect> | undefined, next: NewProspect): Record<string, unknown> {
  const out: Record<string, unknown> = { ...next };
  if (!saved) return out;
  for (const [key, value] of Object.entries(next)) {
    const empty = value === null || (Array.isArray(value) && value.length === 0);
    if (empty && saved[key as keyof Prospect] !== undefined) out[key] = saved[key as keyof Prospect];
  }
  return out;
}

/** Adds stores and refreshes the ones already saved. Leaves status, score
 *  and notes alone. */
export async function upsertProspects(db: SupabaseClient, rows: NewProspect[], now = new Date()): Promise<{ added: number; updated: number }> {
  let added = 0;
  let updated = 0;
  for (let i = 0; i < rows.length; i += LOOKUP) {
    const chunk = rows.slice(i, i + LOOKUP);
    const { data, error } = await db.from("prospects").select("*").in("domain", chunk.map((r) => r.domain));
    if (error) throw error;
    const saved = new Map(((data ?? []) as Prospect[]).map((p) => [p.domain, p]));
    const writes = chunk.map((r) => ({ ...merge(saved.get(r.domain), r), updated_at: now.toISOString() }));
    const { error: upsertError } = await db.from("prospects").upsert(writes, { onConflict: "domain" });
    if (upsertError) throw upsertError;
    added += chunk.filter((r) => !saved.has(r.domain)).length;
    updated += chunk.filter((r) => saved.has(r.domain)).length;
  }
  return { added, updated };
}

export async function prospectByDomain(db: SupabaseClient, domain: string): Promise<Prospect | null> {
  const { data, error } = await db.from("prospects").select("*").eq("domain", domain).maybeSingle();
  if (error) throw error;
  return (data as Prospect | null) ?? null;
}

/** Prospects in a status, best score first for scored ones, else oldest
 *  first. */
export async function listProspects(db: SupabaseClient, opts: { status?: ProspectStatus; limit?: number } = {}): Promise<Prospect[]> {
  let q = db.from("prospects").select("*");
  if (opts.status) q = q.eq("status", opts.status);
  q = opts.status === "qualified" || opts.status === "skipped" ? q.order("score", { ascending: false }) : q.order("created_at");
  if (opts.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Prospect[];
}

/** Stores waiting for a score: new ones, or (rescore) any not yet written to. */
export async function prospectsToScore(db: SupabaseClient, opts: { limit: number; rescore?: boolean }): Promise<Prospect[]> {
  const { data, error } = await db
    .from("prospects")
    .select("*")
    .in("status", opts.rescore ? SCORABLE : ["new"])
    .order("created_at")
    .limit(opts.limit);
  if (error) throw error;
  return (data ?? []) as Prospect[];
}

export async function saveScore(db: SupabaseClient, id: string, r: ScoreResult, now = new Date()): Promise<void> {
  const detail: ScoreDetail = { products: r.products, colorways: r.colorways, reason: r.reason, ...(r.note ? { note: r.note } : {}), teams: r.teams };
  const { error } = await db
    .from("prospects")
    .update({
      status: r.verdict,
      score: r.score,
      best_team: r.best?.key ?? null,
      score_detail: detail,
      scored_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("id", id)
    .in("status", SCORABLE);
  if (error) throw error;
}

export async function setProspectStatus(db: SupabaseClient, id: string, status: ProspectStatus, notes?: string): Promise<void> {
  const { error } = await db
    .from("prospects")
    .update({ status, ...(notes ? { notes } : {}), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// ── Contacts ───────────────────────────────────────────────────────

export interface Contact {
  id: string;
  prospect_id: string;
  email: string;
  name: string | null;
  first_name: string | null;
  title: string | null;
  linkedin: string | null;
  email_status: string | null;
  source: string;
  created_at: string;
}

/** Saves each person under the prospect their company's domain (or work
 *  address) belongs to. People at stores that aren't prospects come back
 *  unmatched. */
export async function addContacts(
  db: SupabaseClient,
  contacts: ContactRow[],
  source: string,
): Promise<{ saved: number; unmatched: ContactRow[] }> {
  const domains = [...new Set(contacts.map(contactDomain).filter((d): d is string => !!d))];
  const ids = new Map<string, string>();
  for (let i = 0; i < domains.length; i += LOOKUP) {
    const { data, error } = await db.from("prospects").select("id, domain").in("domain", domains.slice(i, i + LOOKUP));
    if (error) throw error;
    for (const p of (data ?? []) as { id: string; domain: string }[]) ids.set(p.domain, p.id);
  }
  const unmatched: ContactRow[] = [];
  const rows: Record<string, unknown>[] = [];
  for (const c of contacts) {
    const id = ids.get(contactDomain(c) ?? "");
    if (!id) {
      unmatched.push(c);
      continue;
    }
    rows.push({ prospect_id: id, email: c.email, name: c.name, first_name: c.first_name, title: c.title, linkedin: c.linkedin, email_status: c.email_status, source });
  }
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await db.from("prospect_contacts").upsert(rows.slice(i, i + CHUNK), { onConflict: "prospect_id,email" });
    if (error) throw error;
  }
  return { saved: rows.length, unmatched };
}

export async function contactsFor(db: SupabaseClient, prospectId: string): Promise<Contact[]> {
  const { data, error } = await db.from("prospect_contacts").select("*").eq("prospect_id", prospectId).order("created_at");
  if (error) throw error;
  return (data ?? []) as Contact[];
}

// ── Do not contact ─────────────────────────────────────────────────

export async function addDoNotContact(db: SupabaseClient, values: string[], reason: string | null): Promise<void> {
  const rows = [...new Set(values.map((v) => v.trim().toLowerCase()).filter(Boolean))].map((value) => ({ value, reason }));
  if (!rows.length) return;
  const { error } = await db.from("do_not_contact").upsert(rows, { onConflict: "value" });
  if (error) throw error;
}

/** The entries that rule these out: an address, or its whole domain. */
export async function blockedBy(db: SupabaseClient, values: string[]): Promise<string[]> {
  const wanted = [...new Set(values.map((v) => v.trim().toLowerCase()).filter(Boolean))];
  const out: string[] = [];
  for (let i = 0; i < wanted.length; i += LOOKUP) {
    const { data, error } = await db.from("do_not_contact").select("value").in("value", wanted.slice(i, i + LOOKUP));
    if (error) throw error;
    out.push(...((data ?? []) as { value: string }[]).map((r) => r.value));
  }
  return out;
}

// ── Pitches ────────────────────────────────────────────────────────

export interface Outreach {
  id: string;
  prospect_id: string;
  contact_id: string | null;
  token: string;
  team_key: string;
  moment_id: string | null;
  moment_type: string;
  campaign: PitchPage;
  subject: string;
  body: string;
  status: OutreachStatus;
  sent_at: string | null;
  replied_at: string | null;
  views: number;
  first_viewed_at: string | null;
  last_viewed_at: string | null;
  created_at: string;
}

/** The secret in a pitch link, like an upload link's. */
export const newPitchToken = () => randomBytes(18).toString("base64url");

const TOKEN = /^[A-Za-z0-9_-]{16,64}$/;

/** "abc", "/p/abc" or "https://www.walkoff.io/p/abc?preview=1" -> "abc". */
export function tokenOf(ref: string): string | null {
  const token = ref.trim().split("/p/").pop()!.split(/[/?#]/)[0];
  return TOKEN.test(token) ? token : null;
}

export async function createOutreach(
  db: SupabaseClient,
  row: Pick<Outreach, "prospect_id" | "contact_id" | "token" | "team_key" | "moment_id" | "moment_type" | "campaign" | "subject" | "body">,
): Promise<Outreach> {
  const { data, error } = await db.from("outreach").insert(row).select("*").single();
  if (error) throw error;
  return data as Outreach;
}

export async function outreachFor(db: SupabaseClient, prospectId: string): Promise<Outreach[]> {
  const { data, error } = await db
    .from("outreach")
    .select("id, prospect_id, contact_id, token, team_key, moment_id, moment_type, subject, status, sent_at, replied_at, views, first_viewed_at, last_viewed_at, created_at")
    .eq("prospect_id", prospectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Outreach[];
}

export async function outreachByToken(db: SupabaseClient, token: string): Promise<Outreach | null> {
  if (!TOKEN.test(token)) return null;
  const { data, error } = await db.from("outreach").select("*").eq("token", token).maybeSingle();
  if (error) throw error;
  return (data as Outreach | null) ?? null;
}

/** Counts an open of the pitch page. False when there's no such pitch. */
export async function recordView(db: SupabaseClient, token: string, now = new Date()): Promise<boolean> {
  if (!TOKEN.test(token)) return false;
  const { data, error } = await db.from("outreach").select("id, views, first_viewed_at").eq("token", token).maybeSingle();
  if (error) throw error;
  const row = data as { id: string; views: number; first_viewed_at: string | null } | null;
  if (!row) return false;
  const at = now.toISOString();
  const { error: updateError } = await db
    .from("outreach")
    .update({ views: (row.views ?? 0) + 1, first_viewed_at: row.first_viewed_at ?? at, last_viewed_at: at })
    .eq("id", row.id);
  if (updateError) throw updateError;
  return true;
}

/** Records what came of a pitch, and moves its prospect along: sent is
 *  contacted, a reply is replied. An unsubscribe, or a bounce, puts the
 *  address on the do-not-contact list. An unsubscribe from a pitch with no
 *  address on file puts the store's whole domain there. Returns what it put
 *  on the list, if anything. */
export async function setOutreachStatus(db: SupabaseClient, o: Outreach, status: OutreachStatus, now = new Date()): Promise<string | null> {
  const at = now.toISOString();
  const { error } = await db
    .from("outreach")
    .update({ status, ...(status === "sent" ? { sent_at: at } : {}), ...(status === "replied" ? { replied_at: at } : {}) })
    .eq("id", o.id);
  if (error) throw error;
  if (status === "sent") {
    const { error: e } = await db.from("prospects").update({ status: "contacted", updated_at: at }).eq("id", o.prospect_id).in("status", SCORABLE);
    if (e) throw e;
  }
  if (status === "replied") {
    const { error: e } = await db
      .from("prospects")
      .update({ status: "replied", updated_at: at })
      .eq("id", o.prospect_id)
      .in("status", [...SCORABLE, "contacted"]);
    if (e) throw e;
  }
  if (status !== "unsubscribed" && status !== "bounced") return null;
  let value: string | null = null;
  if (o.contact_id) {
    const { data, error: e } = await db.from("prospect_contacts").select("email").eq("id", o.contact_id).maybeSingle();
    if (e) throw e;
    value = (data as { email: string } | null)?.email ?? null;
  }
  if (!value && status === "unsubscribed") {
    const { data, error: e } = await db.from("prospects").select("domain").eq("id", o.prospect_id).maybeSingle();
    if (e) throw e;
    value = (data as { domain: string } | null)?.domain ?? null;
  }
  if (value) await addDoNotContact(db, [value], status === "bounced" ? "bounced" : "asked not to be contacted");
  return value;
}
