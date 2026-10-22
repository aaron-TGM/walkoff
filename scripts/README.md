# Scripts

Run from the repo root. They read `.env.local` (see `.env.example`).

## Onboarding a brand (done for you)

1. **Create the brand** and get its private upload link:

   ```bash
   npm run brand -- create "Brand name" --email owner@brand.com
   ```

   Send the link only to the brand. Anyone with it can upload to that brand.

2. **The brand uploads** at `walkoff.io/upload/<token>`: an order or customer
   export in step 1, their product export in step 2. Their browser keeps only
   counts per postal area (US 3-digit ZIP, Canadian FSA, UK postcode
   district). Products get keyword tags on upload, and every colorway (the
   variants' color option, with SKUs and photos) is read from the export.
   Common color names ("Azure Heather", "Navy/Gold") get their colors right
   away.

3. **Tag the catalog with Claude**: teams, colors, uses, seasons and
   interests for each product, with a reason for every team, plus what each
   fanciful color name looks like ("Dune", "Cove"):

   ```bash
   npm run affinity:tag -- --brand <brand id or upload token> --dry-run   # look first
   npm run affinity:tag -- --brand <brand id or upload token>             # save and refresh the report
   ```

   It tags products and color names Claude hasn't done yet; `--all` redoes
   everything. Later catalog uploads keep Claude's work. Needs `ANTHROPIC_API_KEY`, or
   `ant auth login`. Uses `DEFAULT_MODEL` in `lib/affinity/claude-tagger.ts`
   at medium effort (`--model`, `--effort`, or `WALKOFF_TAG_MODEL` /
   `WALKOFF_TAG_EFFORT`).
   Requests use prompt caching for the team list and opt in to the API's
   server-side fallback, so a declined batch is retried on another model.
   The run ends with token counts and an estimated cost.

   To try a catalog before the brand exists:

   ```bash
   npm run affinity:tag -- --file products_export.csv --out tags.json
   ```

4. **Read the map**. Each standout territory comes with what to feature when
   that team wins: products made for the team first, then the colorways
   closest to the team's colors, one per team color (a Chargers win picks
   the azure and the sunflower). No logo or license needed.

   ```bash
   npm run brand -- report <brand id or upload token>   # --refresh recomputes, --json for raw
   npm run brand -- list
   ```

5. **Connect Claude.** Add the store address (for product links), then
   invite the people who'll use Walkoff in Claude. They add
   `https://www.walkoff.io/mcp` as a connector and sign in with a code
   emailed to that address (docs/mcp.md):

   ```bash
   npm run brand -- set <brand> --store https://brand.com   # --licensed if they may name teams
   npm run brand -- invite <brand> person@brand.com
   npm run brand -- members <brand>                          # --remove person@brand.com
   ```

## Reference data

```bash
npm run affinity:geo   # rebuilds data/geo/*.json (see data/geo/README.md)
```
