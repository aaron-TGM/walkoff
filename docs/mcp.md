# Walkoff MCP server

Walkoff runs as a remote MCP server at **`https://www.walkoff.io/mcp`**, so
marketers can use it in Claude next to the Klaviyo and Shopify connectors
they already have. Walkoff knows the moments and the fans; it builds the
campaign. Their own Klaviyo connector, on their own permissions, drafts it.

## Connecting

- **Claude (web, desktop, mobile):** Customize → Connectors → Add custom
  connector → `https://www.walkoff.io/mcp`, then sign in. On Team and
  Enterprise plans an owner adds it first, under Organization settings →
  Connectors.
- **Claude Code:** `claude mcp add --transport http walkoff https://www.walkoff.io/mcp`,
  then `/mcp` to sign in.

Use the `www` address: the bare domain redirects, and the token is bound to
the address Claude connected to.

Signing in: Walkoff emails a 6-digit code to the person's work email, they
pick which brands Claude may use, and approve. The consent page names the app
and where it sends them back (claude.ai, or localhost for Claude Code).

## Who can sign in

People invited to a brand, by an operator in Claude (below) or with the
script:

```bash
npm run brand -- invite "Frost Buddy" marketer@frostbuddy.com --by you@walkoff.io   # emails the welcome
npm run brand -- members "Frost Buddy"                            # who has access, who's connected
npm run brand -- members "Frost Buddy" --remove marketer@frostbuddy.com
npm run brand -- set "Frost Buddy" --store frostbuddy.com [--licensed | --unlicensed]
npm run brand -- set "Frost Buddy" --new-upload-link            # after removing someone
```

`WALKOFF_OPERATOR_EMAILS` (comma-separated, on Vercel) can use every brand.
Removing someone cuts access on their next request; refresh stops working.

`--store` gives campaigns product links (`<store>/products/<handle>`).
`--licensed` lets campaign copy name the brand's teams. Without it (the
default, and most brands) copy never names a team, league, player or event:
it nods with the city, for pro teams, and the colors.

## Operators: onboarding brands in Claude

An operator (an address in `WALKOFF_OPERATOR_EMAILS`, signed in with
"Every brand" on the consent page) can set up a brand in one message:

> Set up Frost Buddy: store frostbuddy.com, not licensed, invite jane@frostbuddy.com.

Claude creates the brand, then invites Jane, and Walkoff emails them a
welcome. Later: "Where is each brand in onboarding?"

| Tool | What it does |
|------|--------------|
| `create_brand` | Name, store, `licensed` (default false) and a contact. Returns the brand's id and private upload link. Refuses a name another brand has (any case or spacing) unless `allow_duplicate` is true. |
| `update_brand` | Changes the name, store or license. `new_upload_link: true` replaces the upload link, say after removing someone: the old link stops working, and `invite_member` sends the new one. |
| `invite_member` | Adds someone to a brand and emails them the welcome (`send_email: false` skips it). Safe to repeat: it resends the welcome. |
| `list_members`, `remove_member` | Who can use a brand and whether each has connected. Removing someone ends their access in Claude on their next request; the brand's upload link keeps working until it's replaced. |
| `onboarding_status` | One brand or all: store and license, members and whether each has connected (a live refresh token whose brands include this one), customers uploaded and when, customers mapped, products and colorways, how much of the catalog Claude tagged, triggers, the last campaign, and the next step. |

The next step follows the onboarding order: store, invite, customer upload,
product export, Claude's tagging (`npm run affinity:tag`), connecting
Claude, then a first campaign.

Only operators get these tools. They aren't registered for anyone else
(`tools/list` doesn't show them and calling one fails), each handler checks
again, and brands are found through the operator's own access
(`brandFor`). The tools that change a brand or its people need the brand's
exact name or id: with every brand in reach, "Sun" mustn't land on Sunday
Supply. The consent page tells operators what they're allowing.

**The welcome email** goes only to the person invited, through Resend
(`RESEND_API_KEY`, from `RESEND_FROM_EMAIL`), with replies to the operator
who invited them. It says who invited them and to which brand, links the
brand's upload page (which has the export guides: Shopify orders or
customers, then products), gives the connector steps above with the
address they sign in with, and suggests a first thing to ask Claude ("What
should we send this week?"). Someone already signed in for another brand
also gets a line about disconnecting and connecting again, since a sign-in
reaches only the brands picked when it was made. Without `RESEND_API_KEY`
outside production, the email is printed to the server log. In production
without it, `invite_member` keeps the invite and says the email didn't go.

The upload link is the brand's secret: anyone with it can upload for the
brand. `create_brand` shows it to the operator, and `invite_member` emails
it to the people invited. Don't send it anywhere else. When someone leaves,
replace it (`update_brand` with `new_upload_link`) and invite the others
again. Links in the email use this server's address (`WALKOFF_PUBLIC_URL`
in production).

The script and the tools share `lib/brands.ts` and `lib/welcome.ts`.

## Tools

| Tool | What it does |
|------|--------------|
| `list_brands` | Brands this person can use, with store, license, customers mapped, catalog and standout teams. |
| `get_affinity_map` | Standout fan territories (lift, customers, what they buy) and what to feature for each. |
| `trigger_queue` | Moments to act on now: matching the brand's triggers (or, with none, big moments for its standout teams), not yet drafted, sent or skipped, with how long each keeps. The default takes ordinary wins in weekly sports (NFL, college football, Premier League) but not in sports with a game most days. |
| `recent_moments` | What just happened for the brand's teams, or any team. |
| `upcoming_games` | Games coming up for those teams, in the fans' time zone, with pre-game moments. |
| `match_products` | The brand's products in a team's colors. |
| `get_territory` | A team's fans as a Klaviyo segment: one to three "Someone's proximity to a location" circles on real postal codes (UK clubs also get outward codes), coverage, and how many of the brand's customers live there. `reach: "wide"` adds shared markets. |
| `build_campaign` | Subject lines, preview text, a finished email (Klaviyo HTML with `{% unsubscribe %}` and the address tags), products with links and prices, the audience, the send time (now, or 8 AM local after a late finish), copy rules and the Klaviyo steps. Takes a `moment_id`, or a team and `moment_type` for a sample. |
| `create_trigger`, `list_triggers`, `delete_trigger` | The brand's rules for which moments matter. |
| `log_send`, `send_history` | What the brand drafted, sent or skipped. Logged moments leave the queue. |

Operators also get the onboarding tools above.

There's also a `moment_campaign` prompt that runs the whole loop, and
server instructions that tell Claude the flow and the copy rules (and, for
operators, how to onboard a brand).

**The Klaviyo side.** Klaviyo's connector can create templates and draft
campaigns but not segments, so the first time a brand acts on a team, the
marketer saves the segment once from `get_territory`'s steps (about a
minute). Every later moment reuses it. Scheduling stays with the marketer
unless their Klaviyo connector can do it.

## How sign-in works

OAuth 2.1 as the MCP authorization spec and Claude's connector expect:

- `401` from `/mcp` with `WWW-Authenticate: Bearer resource_metadata=…`.
- Protected resource metadata (RFC 9728) at
  `/.well-known/oauth-protected-resource[/mcp]`, authorization server
  metadata (RFC 8414) at `/.well-known/oauth-authorization-server` (and the
  OpenID path). `next.config.ts` rewrites these to `app/api/oauth/*`.
- Clients identify with a client ID metadata document (Claude does; Walkoff
  fetches and caches it for a day) or register at `/oauth/register`
  (RFC 7591). All clients are public: PKCE S256 is required.
- `/oauth/authorize` runs the email code, brand pick and consent, bound to
  the browser by a cookie, then redirects with `code`, `state` and `iss`
  (RFC 9207). Tokens are bound to the `/mcp` resource (RFC 8707).
- `/oauth/token`: codes last 10 minutes and work once; access tokens 24
  hours; refresh tokens 90 days, rotated on every use. `/oauth/revoke`
  revokes either.
- Codes and tokens are stored only as SHA-256 hashes (`oauth_grants`).
  Revoking any token ends the whole connection.
- The email step answers the same way whether or not an address has
  access, and only invited addresses get a code (10 an hour at most).
- App registration and starting a sign-in are capped per caller and
  overall (`lib/mcp/oauth/limits.ts`, `oauth_events`), and Walkoff only
  fetches client metadata from hosts that resolve to public addresses.

The server is stateless: each request builds a fresh server for the token's
owner, and every query is scoped to the brands they approved.

Code: `lib/mcp/` (tools, campaign builder, audience, timing, queue),
`lib/mcp/oauth/`, routes in `app/mcp` and `app/oauth`. Tables:
`supabase/006_mcp.sql`.

## Setup

1. Run `supabase/006_mcp.sql`, then `supabase/007_hardening.sql`, in the
   Supabase SQL editor.
2. On Vercel: `WALKOFF_OPERATOR_EMAILS`, plus `RESEND_API_KEY` and a
   `RESEND_FROM_EMAIL` on a domain verified in Resend (sign-in codes and
   welcome emails won't send without them), and
   `WALKOFF_PUBLIC_URL=https://www.walkoff.io` for Production only.
3. Set brands up in Claude as an operator, or with `npm run brand`
   (`scripts/README.md`), and invite the people who'll use them.

Locally, without `RESEND_API_KEY`, sign-in codes and welcome emails print
to the dev server log.
