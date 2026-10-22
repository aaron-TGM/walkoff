// Colors for matching a brand's colorways to a team. Brand color names
// ("Azure Heather", "Sunflower") become hex values from a lexicon of common
// fashion color words; Claude names the fanciful rest (scripts/tag-catalog).
// Closeness is measured in Lab space, which tracks how people see color.
import { COLORS } from "./tagging";

type Lab = [number, number, number];

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace(/^#/, ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return [r, g, b].map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, "0")).join("");
}

const labs = new Map<string, Lab>();

/** sRGB to CIE Lab (D65). */
export function toLab(hex: string): Lab {
  const hit = labs.get(hex);
  if (hit) return hit;
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const lab: Lab = [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
  labs.set(hex, lab);
  return lab;
}

/** How different two colors look (CIEDE2000), with lightness counted half
 *  as textile matching does: a lighter or darker shade of the same hue still
 *  reads as that color. Under ~3 is the same color, over ~13 a different one. */
export function colorDistance(hex1: string, hex2: string, kL = 2): number {
  const [L1, a1, b1] = toLab(hex1);
  const [L2, a2, b2] = toLab(hex2);
  const rad = Math.PI / 180;
  const meanC = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
  const g = 0.5 * (1 - Math.sqrt(meanC ** 7 / (meanC ** 7 + 25 ** 7)));
  const a1p = (1 + g) * a1;
  const a2p = (1 + g) * a2;
  const C1 = Math.hypot(a1p, b1);
  const C2 = Math.hypot(a2p, b2);
  const hue = (b: number, a: number) => (b === 0 && a === 0 ? 0 : (Math.atan2(b, a) / rad + 360) % 360);
  const h1 = hue(b1, a1p);
  const h2 = hue(b2, a2p);
  let dh = C1 * C2 === 0 ? 0 : h2 - h1;
  if (dh > 180) dh -= 360;
  else if (dh < -180) dh += 360;
  const dH = 2 * Math.sqrt(C1 * C2) * Math.sin((dh / 2) * rad);
  const L = (L1 + L2) / 2;
  const C = (C1 + C2) / 2;
  let h = h1 + h2;
  if (C1 * C2 !== 0) h = (Math.abs(h1 - h2) > 180 ? h + (h < 360 ? 360 : -360) : h) / 2;
  const t =
    1 - 0.17 * Math.cos((h - 30) * rad) + 0.24 * Math.cos(2 * h * rad) +
    0.32 * Math.cos((3 * h + 6) * rad) - 0.2 * Math.cos((4 * h - 63) * rad);
  const sL = 1 + (0.015 * (L - 50) ** 2) / Math.sqrt(20 + (L - 50) ** 2);
  const sC = 1 + 0.045 * C;
  const sH = 1 + 0.015 * C * t;
  const rT = -Math.sin(60 * Math.exp(-(((h - 275) / 25) ** 2)) * rad) * 2 * Math.sqrt(C ** 7 / (C ** 7 + 25 ** 7));
  const dl = (L2 - L1) / (kL * sL);
  const dc = (C2 - C1) / sC;
  const dhh = dH / sH;
  return Math.sqrt(dl ** 2 + dc ** 2 + dhh ** 2 + rT * dc * dhh);
}

/** 1 for the same color, 0.5 at the edge of "that's their color", 0 for a
 *  clearly different one. A neutral never stands in for a real color: black
 *  isn't midnight green. */
export function colorMatch(a: string, b: string): number {
  const match = Math.max(0, 1 - colorDistance(a, b) / 20);
  return isNeutral(a) === isNeutral(b) ? match : match * 0.3;
}

/** Black, white, grays and silvers: every team and catalog has them, so
 *  they say little about which team a product nods to. */
export function isNeutral(hex: string): boolean {
  const [, a, b] = toLab(hex);
  return Math.hypot(a, b) < 12;
}

function mix(hex: string, toward: string, amount: number): string {
  const a = hexToRgb(hex);
  const b = hexToRgb(toward);
  return rgbToHex([0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * amount) as [number, number, number]);
}

// Common words in apparel color names. Two-word phrases win over words.
const PHRASES: Record<string, string> = {
  "powder blue": "8fb8de", "baby blue": "89cff0", "light blue": "add8e6", "sky blue": "87ceeb",
  "carolina blue": "7bafd4", "columbia blue": "9bcbeb", "royal blue": "2549b5", "navy blue": "1f2a44",
  "dusty blue": "6e8faf", "steel blue": "4682b4", "slate blue": "6a7fb0", "electric blue": "2b6cff",
  "true blue": "0050b5", "midnight green": "004c54", "kelly green": "00843d", "forest green": "1e4d2b",
  "hunter green": "355e3b", "army green": "4b5320", "olive green": "6b6f2e", "sage green": "9caf88",
  "mint green": "98d8c1", "burnt orange": "bf5700", "safety orange": "ff6700", "blaze orange": "ff6700",
  "old gold": "cfb87c", "vegas gold": "c5b358", "athletic gold": "ffb612", "heather grey": "b6b6b4",
  "heather gray": "b6b6b4", "off white": "f2efe6", "light grey": "c8c8c8", "light gray": "c8c8c8",
  "dark grey": "555555", "dark gray": "555555", "hot pink": "ff69b4", "light pink": "f8c8d4",
};

const WORDS: Record<string, string> = {
  // neutrals
  black: "141414", onyx: "1b1b1b", jet: "1c1c1c", coal: "2b2b2b", ink: "1f2430", shadow: "4a4a4a",
  charcoal: "36454f", graphite: "3d3f42", iron: "4b4f54", slate: "5f6b78", storm: "5c6b7a",
  pewter: "8a8d8f", steel: "71797e", gray: "8e8e8e", grey: "8e8e8e", heather: "b6b6b4", ash: "b2b5b2",
  smoke: "9ea3a6", fog: "c9ccce", cement: "a8a9a4", concrete: "a8a9a4", silver: "c0c4c8",
  stone: "aaa59b", pebble: "bdb8ad", white: "f7f7f5", ivory: "fffff0", cream: "f3e9d2", bone: "e3dac9",
  chalk: "eeeae2", salt: "efeee9", snow: "fbfbfb", natural: "e8dfcc", ecru: "e2d8c3",
  oatmeal: "d9cdb8", oat: "d9cdb8", linen: "e8e0d0", sand: "d8c3a5", dune: "cbb593", desert: "c9a97a",
  khaki: "c3b091", tan: "d2b48c", camel: "c19a6b", beige: "e1d3b8", taupe: "8b7d6b",
  mushroom: "a39a8b", driftwood: "a8977c", brown: "6b4423", chocolate: "4e2a1e", mocha: "6f4e37",
  coffee: "5b3a29", espresso: "3c2218", cocoa: "5c4033", chestnut: "7b3f2a", walnut: "5c4433",
  cognac: "9a463d", saddle: "8b4513", caramel: "af6f09", toffee: "9b6a3c", canyon: "b5651d",
  olive: "6b6f2e", army: "4b5320", moss: "8a9a5b", sage: "9caf88", fatigue: "6b6a4a", loden: "4d5a3a",
  cargo: "7a7550",
  // blues
  navy: "1f2a44", midnight: "1b1f3b", indigo: "2e3a6e", denim: "3b5b92", marine: "1b4f8a",
  admiral: "253a5e", cobalt: "0047ab", royal: "2549b5", sapphire: "0f52ba", blue: "2f6fd0",
  azure: "2e8bd8", ocean: "1d6fa3", lake: "3a7ca5", harbor: "3e6d8e", sky: "87ceeb",
  bluebird: "6ca0dc", cornflower: "6495ed", periwinkle: "8c9cde", ice: "cfe6f2", glacier: "b8d7e8",
  horizon: "8ab6d6", teal: "008080", aqua: "35c3c3", turquoise: "30d5c8", cyan: "00b7eb",
  lagoon: "2a9d8f", seafoam: "93e9be", mint: "98d8c1",
  // greens
  green: "2e8b57", kelly: "00843d", forest: "1e4d2b", hunter: "355e3b", emerald: "009b77",
  pine: "2c5f2d", spruce: "2c4f43", evergreen: "1f3a2d", jade: "00a86b", lime: "a4d65e",
  clover: "3a8a3a", grass: "5a9a3a", fern: "4f7942", eucalyptus: "6e8b74", basil: "5c7a4a",
  // reds and pinks
  red: "c8102e", scarlet: "bb0000", crimson: "9e1b32", cherry: "b5121b", cardinal: "c41e3a",
  ruby: "9b111e", brick: "8b3a2e", rust: "b7410e", terracotta: "c8644b", clay: "b66a50",
  maroon: "6a1f2b", burgundy: "7a1f3d", wine: "722f37", oxblood: "5a1a1a", garnet: "73000a",
  cranberry: "9f1d35", merlot: "73343a", raspberry: "b3245b", coral: "ff7f50", salmon: "fa8072",
  pink: "f4a6c0", blush: "e8b4b8", rose: "d46a7e", magenta: "c0337b", fuchsia: "d63384",
  berry: "8e3a59", watermelon: "fc6c85", flamingo: "f2a0a8",
  // oranges and yellows
  orange: "f26b21", tangerine: "f28500", pumpkin: "e8761c", peach: "ffcba4", apricot: "fbceb1",
  papaya: "ffa069", sunset: "f5845c", melon: "f9a07a", amber: "ffbf00", gold: "ffb81c",
  mustard: "e1ad01", marigold: "eaa221", sunflower: "ffc512", saffron: "f4c430", honey: "e8a92e",
  maize: "ffcb05", lemon: "fff44f", canary: "ffef00", yellow: "ffd100", butter: "fbe29b",
  banana: "ffe135", citrus: "f2d33a", sunshine: "ffc20e",
  // purples
  purple: "5f259f", violet: "7f3fbf", lavender: "b9a3d9", lilac: "c8a2c8", plum: "673147",
  eggplant: "614051", grape: "6f2da8", orchid: "da70d6", amethyst: "9966cc", mauve: "b784a7",
};

const LIGHTER = new Set(["light", "pale", "dusty", "washed", "faded", "soft"]);
const DARKER = new Set(["dark", "deep"]);

/** Hex values for a brand's color name, from common color words:
 *  "Azure Heather" -> one blue, "Navy/Gold" -> two. Empty when no word is
 *  known ("Cove"); Claude names those. */
export function hexForColorName(name: string): string[] {
  const tokens = name.toLowerCase().replace(/[^a-z]+/g, " ").trim().split(" ").filter(Boolean);
  const found: string[] = [];
  const used = new Set<number>();
  for (let i = 0; i < tokens.length - 1; i++) {
    const hex = PHRASES[`${tokens[i]} ${tokens[i + 1]}`];
    if (hex) {
      found.push(hex);
      used.add(i).add(i + 1);
    }
  }
  const words = tokens.map((t, i) => (used.has(i) ? null : WORDS[t] ? t : null)).filter((t): t is string => t !== null);
  // "Azure Heather" is a heathered azure, not azure and gray.
  const colorWords = words.length > 1 ? words.filter((w) => w !== "heather") : words;
  for (const w of colorWords) found.push(WORDS[w]);
  const shade = tokens.some((t) => LIGHTER.has(t)) ? "lighter" : tokens.some((t) => DARKER.has(t)) ? "darker" : null;
  const out = [...new Set(found)].slice(0, 3);
  if (!shade || used.size) return out;
  return out.map((h) => (shade === "lighter" ? mix(h, "ffffff", 0.35) : mix(h, "000000", 0.3)));
}

/** Where each color family sits, for naming a hex the way a shopper would. */
const FAMILY_HEX: Record<(typeof COLORS)[number], string> = {
  "midnight green": "004c54", "kelly green": "00843d", "forest green": "1e4d2b", green: "2e8b57",
  navy: "1f2a44", "royal blue": "2549b5", "light blue": "8ec5e8", blue: "1e73be", red: "d50a0a",
  scarlet: "bb0000", crimson: "9e1b32", maroon: "6a1f2b", burgundy: "7a1f3d", orange: "f26b21",
  gold: "ffb612", yellow: "ffd100", purple: "4f2683", black: "141414", white: "f7f7f5",
  gray: "8a8d8f", silver: "c0c4c8", teal: "008e97", pink: "f4a6c0", brown: "6b4423",
  cream: "f3e9d2", tan: "cdb38b", olive: "6b6f2e", charcoal: "36454f", sage: "9caf88",
};

/** The color family a shopper would call this hex: "0080c6" -> "blue".
 *  Lightness counts in full here: navy and light blue are different names. */
export function colorFamily(hex: string): (typeof COLORS)[number] {
  let best: (typeof COLORS)[number] = "black";
  let bestD = Infinity;
  for (const family of COLORS) {
    const d = colorDistance(hex, FAMILY_HEX[family], 1);
    if (d < bestD) {
      bestD = d;
      best = family;
    }
  }
  return best;
}

export function familyHex(family: string): string | undefined {
  return FAMILY_HEX[family as (typeof COLORS)[number]];
}

/** A team's colors with how much each says about the team: the main color
 *  most, and neutrals little. */
export function teamPalette(colors: string[]): { hex: string; weight: number }[] {
  return colors.map((hex, i) => ({ hex, weight: (i === 0 ? 1 : i === 1 ? 0.85 : 0.6) * (isNeutral(hex) ? 0.35 : 1) }));
}
