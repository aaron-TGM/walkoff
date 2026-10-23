# Walkoff

Walkoff (walkoff.io, Tuff Ghost Media LLC) turns real-world moments, sports
first, into ready-made campaigns for brands whose customers are fans. Brands
upload counts of customers per postal area and their catalog; Walkoff finds
the fan territories they over-index in, watches every game, and when a
moment hits it builds the campaign: products in the team's colors, the
audience, the send time. Marketers use it in Claude through the MCP server
at `https://www.walkoff.io/mcp`, next to their own Klaviyo and Shopify
connectors, which draft and send.

## Product rules (don't break these)

- **Never name teams for brands without a license.** Campaign copy a shopper
  sees never names the team, league, players, stadium or event. It nods with
  the colors, and with the city for pro teams only when the audience lives
  there (the Chargers' core audience is San Diego, so no "LA"). Licensed
  brands (`brands.licensed`) may name the team. Internal text for marketers
  (moment headlines, alert emails) may name teams. See `lib/mcp/campaign.ts`.
- **Approval first.** Walkoff drafts; the marketer sends. Nothing schedules
  or sends without their go-ahead.
- **Counts, not customer lists.** Only counts per postal area (US 3-digit
  ZIP, Canadian FSA, UK district) leave the brand's browser, and the server
  rejects anything finer (`lib/affinity/validate.ts`).
- **Brands are walled off.** Every brand-scoped MCP query goes through the
  signed-in person's brands (`brandFor`/`brandsFor` in `lib/mcp/data.ts`).
  Operators (`WALKOFF_OPERATOR_EMAILS`) reach every brand.

## Map

| Path | What |
|------|------|
| `app/` | Next.js 15 site on Vercel: marketing page, `/upload/[token]`, `/status`, `/mcp`, `/oauth/*` |
| `lib/affinity/` | Postal areas and team homes (`geo`), fan territories, the affinity map (`compute`), colors and picks, uploads, storage |
| `lib/mcp/` | MCP tools, campaign builder, audiences (Klaviyo proximity circles), send timing, queue, team lookup |
| `lib/mcp/oauth/` | OAuth 2.1 for Claude's connector: metadata, client registration and metadata documents, emailed-code sign-in, tokens, limits |
| `engine/` | Moment engine on Cloud Run: polls the ESPN scoreboards, detects moments (`moments/rules.ts`), writes Supabase |
| `scripts/` | `npm run brand` (brands, members), `npm run affinity:tag` (Claude catalog tagging), geo builds |
| `supabase/` | Migrations, run by hand in the Supabase SQL editor, in order. Each is idempotent |
| `docs/mcp.md` | MCP tools, sign-in design, setup |

## Commands

```bash
npm test            # all unit tests (node:test via tsx), engine and lib
npm run lint
npx next build
npm run engine:test
npm run brand -- list
```

Tests sit next to code as `*.test.ts`. For end-to-end checks of the MCP
server: Postgres 16 and PostgREST 12 locally (roles `anon`, `authenticated`,
`service_role` with BYPASSRLS, `authenticator`; apply `supabase/0*.sql` in
order), a small proxy so `/rest/v1/*` reaches PostgREST, a `service_role`
JWT signed with PostgREST's secret as `SUPABASE_SERVICE_ROLE_KEY`, and
`next dev`. Without `RESEND_API_KEY`, sign-in codes print to the dev log.
Drive it with the MCP SDK client. Never test against production data.

## Shipping

- Site and MCP server: merging to `main` deploys to Vercel (www.walkoff.io).
  Use the `www` address; the bare domain redirects.
- Engine: Cloud Run service `walkoff-engine`, project `walkoff-512421`,
  region `us-central1`. Rebuild and redeploy from Cloud Shell after engine
  changes (`engine/README.md`).
- Database changes: a new numbered, idempotent file in `supabase/`, run by
  hand. Every table has RLS on with no policies: only the service role key
  (server-side only) reads or writes. Ship code that works before and after
  its migration runs.
- New endpoints anyone can call without signing in need limits
  (`lib/mcp/oauth/limits.ts`).

## Style

- User-facing text: plain, short sentences, no em dashes.
- Code: match what's around it. Few comments, and they say why.
- No secrets in code, commits or docs. Env vars are listed in `.env.example`.
