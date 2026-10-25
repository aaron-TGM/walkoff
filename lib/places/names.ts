// Place names as one comparable key, shared by the build (scripts/build-
// places.ts) and the lookups here, so "St. Louis", "Saint Louis" and
// "saint-louis" all meet.

/** Short forms that start a place name's words. */
const WORDS: Record<string, string> = {
  st: "saint",
  ste: "sainte",
  ft: "fort",
  mt: "mount",
  pt: "point",
};

/** "St. Louis" -> "saintlouis", "Coeur d'Alene" -> "coeurdalene",
 *  "Bayamón" -> "bayamon", "Mc Lean" -> "mclean". */
export function nameKey(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’`]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((w) => WORDS[w] ?? w)
    .join("");
}
