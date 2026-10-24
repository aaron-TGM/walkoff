// One guarded GET for pages brands publish, like a Shopify store's public
// product feed. https only, a public host name, and every address it resolves
// to public, checked again on each redirect, with a time limit and a size cap.
// So a store address can't point Walkoff at its own network. The OAuth client
// metadata fetch uses the same address checks (oauth/clients.ts).
import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";

/** A host's addresses. Tests pass their own. */
export type Lookup = (host: string) => Promise<string[]>;

const systemLookup: Lookup = async (host) => (await dnsLookup(host, { all: true, verbatim: true })).map((a) => a.address);

/** Loopback, private, link-local, carrier-grade NAT, multicast and
 *  reserved addresses: nothing a public page lives on. */
export function privateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }
  const v = ip.toLowerCase();
  const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return privateAddress(mapped[1]);
  return v === "::" || v === "::1" || /^f[cd]/.test(v) || /^fe[89ab]/.test(v) || v.startsWith("ff");
}

/** Whether every address a host resolves to is public. */
export async function hostVerdict(host: string, lookup: Lookup = systemLookup): Promise<"public" | "private" | "unresolved"> {
  let addresses: string[];
  try {
    addresses = await lookup(host);
  } catch {
    return "unresolved";
  }
  if (!addresses.length) return "unresolved";
  return addresses.some(privateAddress) ? "private" : "public";
}

export type RefusedReason = "address" | "private" | "unresolved" | "redirects" | "too_big" | "timeout" | "network";

/** Why a page wasn't read. Callers turn the reason into their own words. */
export class FetchRefused extends Error {
  constructor(
    readonly reason: RefusedReason,
    message: string,
  ) {
    super(message);
  }
}

export interface PublicGetOptions {
  fetch?: typeof fetch;
  lookup?: Lookup;
  /** For the whole request: every redirect and the body. */
  timeoutMs: number;
  maxBytes: number;
  maxRedirects: number;
  headers?: Record<string, string>;
}

export interface PublicResponse {
  status: number;
  /** Where the answer came from, after any redirects. */
  url: string;
  contentType: string;
  retryAfter: string | null;
  text: string;
}

/** https, the default port, no user name, and a host name with a dot that
 *  isn't an IP address or a local name. */
function checkAddress(u: URL): void {
  const host = u.hostname;
  const ok =
    u.protocol === "https:" &&
    !u.port &&
    !u.username &&
    !u.password &&
    !isIP(host) &&
    !host.startsWith("[") &&
    host.includes(".") &&
    !/(^|\.)(localhost|local|internal)$/.test(host);
  if (!ok) throw new FetchRefused("address", `${u.origin} isn't a public https address.`);
}

async function readCapped(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new FetchRefused("too_big", `The page is over ${maxBytes} bytes.`);
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    body.set(c, at);
    at += c.byteLength;
  }
  return new TextDecoder().decode(body);
}

const REDIRECTS = new Set([301, 302, 303, 307, 308]);

/** GETs a public page, following redirects by hand so each hop is checked. */
export async function publicGet(url: string, o: PublicGetOptions): Promise<PublicResponse> {
  const doFetch = o.fetch ?? fetch;
  const lookup = o.lookup ?? systemLookup;
  const signal = AbortSignal.timeout(o.timeoutMs);
  let current: URL;
  try {
    current = new URL(url);
  } catch {
    throw new FetchRefused("address", `${url} isn't an address.`);
  }
  for (let hop = 0; ; hop++) {
    checkAddress(current);
    const verdict = await hostVerdict(current.hostname, lookup);
    if (verdict === "private") throw new FetchRefused("private", `${current.hostname} points at a private address.`);
    if (verdict === "unresolved") throw new FetchRefused("unresolved", `${current.hostname} didn't resolve.`);
    try {
      const res = await doFetch(current, { redirect: "manual", signal, cache: "no-store", headers: o.headers });
      if (REDIRECTS.has(res.status)) {
        const location = res.headers.get("location");
        await res.body?.cancel();
        if (!location) throw new FetchRefused("network", `${current.hostname} redirected nowhere.`);
        if (hop >= o.maxRedirects) throw new FetchRefused("redirects", `${current.hostname} redirected too many times.`);
        current = new URL(location, current);
        continue;
      }
      if (Number(res.headers.get("content-length") ?? 0) > o.maxBytes) {
        await res.body?.cancel();
        throw new FetchRefused("too_big", `The page is over ${o.maxBytes} bytes.`);
      }
      const text = await readCapped(res, o.maxBytes);
      return {
        status: res.status,
        url: current.toString(),
        contentType: res.headers.get("content-type") ?? "",
        retryAfter: res.headers.get("retry-after"),
        text,
      };
    } catch (err) {
      if (err instanceof FetchRefused) throw err;
      if (signal.aborted) throw new FetchRefused("timeout", `${current.hostname} took longer than ${o.timeoutMs} ms.`);
      throw new FetchRefused("network", `${current.hostname} couldn't be reached.`);
    }
  }
}
