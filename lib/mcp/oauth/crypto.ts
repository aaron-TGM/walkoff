import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/** A random secret, URL-safe. Prefixes make leaked tokens easy to spot. */
export const randomToken = (prefix = "", bytes = 32) => `${prefix}${randomBytes(bytes).toString("base64url")}`;

/** Codes and tokens are stored only as SHA-256 hashes. */
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export const sixDigits = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

export function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

const VERIFIER = /^[A-Za-z0-9._~-]{43,128}$/;
export const CHALLENGE = /^[A-Za-z0-9_-]{43,128}$/;

/** PKCE (RFC 7636), S256 only. */
export function pkceMatches(verifier: string | null | undefined, challenge: string): boolean {
  if (!verifier || !VERIFIER.test(verifier)) return false;
  return sameHash(createHash("sha256").update(verifier).digest("base64url"), challenge);
}
