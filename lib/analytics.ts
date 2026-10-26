// Measurement for the site, with nothing stored on the visitor's device.
// Vercel Web Analytics counts page views without cookies, and redact() takes
// private links out before anything is sent. For early access requests, the
// visit's first page and the last early access button clicked stay in
// memory until the form is sent, so each signup records where it came from.
import type { Attribution } from "./waitlist";

/** A brand's upload link works like a password: /upload/<token>. So does a
 *  prospect's pitch: /p/<token>. The public demos keep their addresses. */
export function privatePath(pathname: string): string {
  return pathname
    .replace(/^\/upload\/(?!demo(?:\/|$))[^/]+/, "/upload/[token]")
    .replace(/^\/p\/(?!demo(?:\/|$))[^/]+/, "/p/[token]");
}

/** Query parameters worth counting: campaign tags and ref. */
const KEPT = /^(utm_[a-z]+|ref)$/;

/** Vercel's beforeSend: drops sign-in pages, hides upload tokens, and keeps
 *  only campaign tags in the query, never a value with an @ in it. */
export function redact<E extends { url: string }>(event: E): E | null {
  let url: URL;
  try {
    url = new URL(event.url);
  } catch {
    return null;
  }
  if (url.pathname.startsWith("/oauth")) return null;
  url.pathname = privatePath(url.pathname);
  for (const [key, value] of [...url.searchParams]) {
    if (!KEPT.test(key) || value.includes("@")) url.searchParams.delete(key);
  }
  return { ...event, url: url.toString() };
}

const UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

/** Where a visit came from: its campaign tags, the site that sent it (the
 *  host only) and the page it landed on. */
export function firstTouch(href: string, referrer: string): Attribution {
  const url = new URL(href);
  const touch: Attribution = { landing_path: privatePath(url.pathname) };
  for (const key of UTM) {
    const value = url.searchParams.get(key)?.trim();
    if (value && !value.includes("@")) touch[key] = value;
  }
  try {
    const from = new URL(referrer);
    if (from.host !== url.host) touch.referrer = from.host;
  } catch {
    // No referrer: typed in, a bookmark, or the sending site hid it.
  }
  return touch;
}

let visit: Attribution | null = null;
let lastCta: string | null = null;

/** Keeps the visit's first page. Later calls change nothing. */
export function rememberVisit(href: string, referrer: string) {
  visit ??= firstTouch(href, referrer);
}

/** Keeps the last early access button clicked, by its data-cta. */
export function rememberCta(placement: string) {
  lastCta = placement;
}

/** What an early access request sends about where it came from. */
export function visitAttribution(): Attribution {
  return lastCta ? { ...visit, cta_placement: lastCta } : { ...visit };
}
