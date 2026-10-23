# Scripts

Run from the repo root. They read `.env.local` (see `.env.example`).

## Onboarding a brand (done for you)

Walkoff operators can do steps 1 and 2 in Claude instead, in one message
("Set up Frost Buddy: store frostbuddy.com, not licensed, invite
jane@frostbuddy.com"), and ask there where each brand is
(`docs/mcp.md`, Operators). The script and those tools share
`lib/brands.ts`.

1. **Create the brand** with its store (for product links) and whether it's
   licensed to name its teams. It prints the brand's private upload link.

   ```bash
   npm run brand -- create "Brand name" --store brand.com [--licensed] [--email owner@brand.com]
   npm run brand -- set <brand> [--store brand.com] [--licensed | --unlicensed] [--name "New name"] [--new-upload-link]
   ```

   A name another brand has (in any case or spacing) is refused; add
   `--allow-duplicate` if it really is a different brand. Anyone with the
   upload link can upload to that brand, so it only goes to the people you
   invite. `--new-upload-link` replaces it when someone leaves; invite the
   others again to send them the new one.

2. **Invite the people who'll use it.** Each gets a welcome email: who
   invited them, their upload link (the page has the export guides), how to
   add `https://www.walkoff.io/mcp` as a connector in Claude and sign in
   with that address, and a first thing to ask Claude.

   ```bash
   npm run brand -- invite <brand> person@brand.com --by you@walkoff.io   # --no-welcome skips the email
   npm run brand -- members <brand>                                        # who's connected; --remove person@brand.com
   ```

   The email goes through Resend (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`)
   and replies go to `--by`. Without a key it's printed instead. Inviting
   someone again resends it. Links use `WALKOFF_PUBLIC_URL`, else
   `https://www.walkoff.io`.

3. **The brand uploads** at `walkoff.io/upload/<token>`: an order or customer
   export in step 1, their product export in step 2. Their browser keeps only
   counts per postal area (US 3-digit ZIP, Canadian FSA, UK postcode
   district). Products get keyword tags on upload, and every colorway (the
   variants' color option, with SKUs and photos) is read from the export.
   Common color names ("Azure Heather", "Navy/Gold") get their colors right
   away.

4. **Tag the catalog with Claude**: teams, colors, uses, seasons and
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

5. **Read the map**. Each standout territory comes with what to feature when
   that team wins: products made for the team first, then the colorways
   closest to the team's colors, one per team color (a Chargers win picks
   the azure and the sunflower). No logo or license needed.

   ```bash
   npm run brand -- report <brand id or upload token>   # --refresh recomputes, --json for raw
   npm run brand -- list
   ```

   Once the people you invited connect Walkoff in Claude (they sign in with
   a code emailed to their address, docs/mcp.md), they can ask for their
   first campaign.

## Reference data

```bash
npm run affinity:geo   # rebuilds data/geo/*.json (see data/geo/README.md)
```
