# Walkoff MCP server

Walkoff runs as a remote MCP server at **`https://www.walkoff.io/mcp`**, so
marketers can use it in Claude next to the Klaviyo connector they already
have. Walkoff knows the moments and the fans; it builds the campaign. Their
own Klaviyo connector, on their own permissions, drafts it. Setting a brand
up is one ask in Claude, and the Shopify connector is optional: see
[Setting a brand up](#setting-a-brand-up).

For marketers, the help center explains all of this in plain words:
[www.walkoff.io/help](https://www.walkoff.io/help), with the setup guide at
[/onboarding](https://www.walkoff.io/onboarding). Its pages live in
`app/(guide)/`; their list, sections and links are in `lib/help/pages.ts`,
and `lib/help/help.test.ts` keeps them in step with the tools, messages and
rules they describe. When a tool, a message people see or a number changes,
the test says which help page to update.

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
and where it sends them back (claude.ai, or localhost for Claude Code). Any
app can call itself Claude, so one that sends people back to a website other
than Claude's is named by that site's address instead, there and in the code
email.

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
| `create_brand` | Name, store, `licensed` (default false) and a contact. Returns the brand's id and private upload link. The store is where `import_catalog` reads the catalog from. Refuses a name another brand has (any case or spacing) unless `allow_duplicate` is true. |
| `update_brand` | Changes the name, store or license. `new_upload_link: true` replaces the upload link, say after removing someone: the old link stops working, and `invite_member` sends the new one. |
| `invite_member` | Adds someone to a brand and emails them the welcome (`send_email: false` skips it). Safe to repeat: it resends the welcome. |
| `list_members`, `remove_member` | Who can use a brand and whether each has connected. Removing someone ends their access in Claude on their next request; the brand's upload link keeps working until it's replaced. |
| `onboarding_status` | One brand or all: store and license, members and whether each has connected (a live refresh token whose brands include this one), customer counts and where they came from (an upload, like a Klaviyo export, or Shopify in Claude) and when, customers mapped, products and colorways, how much of the catalog Claude tagged, triggers, the last campaign, and the next step. A brand with a catalog is ready for campaigns: the fan map is a suggestion on the step, not a step. |
| `set_athlete_home` | Sets where an athlete is from when Walkoff has it wrong, over every source, or clears it (`clear: true`). Takes a town ("San Clemente, CA") or a postal code, and a required note on where you learned it. Shows the athlete's homes before and after. |
| `record_athlete_rights` | Records an athlete's written agreement (an NIL or sponsor deal) that a brand may name them: `starts_on`, `ends_on` and `evidence` (where the agreement is) are required. `revoke: true` revokes what's on file. Without an agreement in date, copy never names an athlete. |
| `create_moment` | Records a win Walkoff doesn't follow itself (a medal, a big-wave contest) and makes the moment for each town the athlete is from right away. An athlete Walkoff knows, or someone new with their `sport` and `hometown`; a `note` on where you learned it is required. Running it again adds nothing. |
| `retract_moment` | Takes a wrong moment back, with a reason: it leaves every queue and `build_campaign` refuses it. Lists the brands that already drafted or sent it. |
| `exclude_athlete` | For an athlete who asks Walkoff to stop using them (the privacy policy's promise): deletes where they're from, never saves it again, and makes no hometown moment or big signing about them. A `note` on who asked is required; lists their moments from the last week, to retract. `undo: true` takes it back. Needs `supabase/011_athlete_opt_outs.sql`. |

The next step follows the onboarding order: store, invite, connecting
Claude, the catalog (`import_catalog` in Claude, or a product export on the
upload page), then a first campaign. Connecting comes before data, since
setup happens in Claude. The fan map isn't a step: a brand with a catalog
is ready for campaigns. Until a map is in, the "first campaign" and "live"
steps add a suggestion to add it (a Klaviyo profile export on the upload
page, or the Shopify queries in Claude), and say so when the counts placed
nobody. Claude's tagging runs on its own in the engine within minutes of a
catalog import or upload, so it's the next step only when it's an hour
behind on more than a tenth of the catalog (then: check the engine, or run
`npm run affinity:tag`). Operators get the member
tools too, so an operator can run `import_catalog` for any brand.

Only operators get these tools. They aren't registered for anyone else
(`tools/list` doesn't show them and calling one fails), each handler checks
again, and brands are found through the operator's own access
(`brandFor`). The tools that change a brand or its people need the brand's
exact name or id: with every brand in reach, "Sun" mustn't land on Sunday
Supply. The consent page tells operators what they're allowing.

**The welcome email** goes only to the person invited, through Resend
(`RESEND_API_KEY`, from `RESEND_FROM_EMAIL`), with replies to the operator
who invited them. It says who invited them and to which brand, gives the
connector steps above with the address they sign in with (and the line for
Team and Enterprise owners), tells them to connect Klaviyo, with one line
saying Shopify in Claude is optional, and to ask Claude "Set up Walkoff for
<brand>", which imports the catalog. Then it suggests "What should we send
this week?". Last comes the fan map: export the Klaviyo list or segment
they send to, with Email, Zip Code and Country, and drop it in step 1 of
the brand's private upload page (the link, the "private, don't share" line,
what the browser keeps, and a line about product exports for stores not on
Shopify). Someone already signed in for another brand
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
| `import_catalog` | Reads the brand's products from its Shopify store's public feed and saves them like a product export: new ones added, the rest updated, nothing removed. No customer data, and no Shopify connector. With a catalog, the brand is ready for campaigns. |
| `import_customer_counts` | Only with a Shopify connector in Claude: customer counts from Walkoff's two ShopifyQL queries, run by Claude with that connector, as text rows. Keeps only areas and counts, spreads the rest by population, replaces the brand's counts and redraws the map. |
| `list_brands` | Brands this person can use, with store, license, customers mapped, catalog and standout teams. `setup_needed: ["catalog"]` when there's no catalog yet, the only thing campaigns need. Without a fan map, `fan_map_suggestion` suggests a Klaviyo export (or the Shopify queries) as an optional next step. |
| `get_affinity_map` | Standout fan territories (lift, customers, what they buy) and what to feature for each. |
| `local_athletes` | Athletes from towns near the brand's customers, town by town: estimated customers in each town's circle and the lift, and each athlete's team, position, how Walkoff knows where they're from, and any naming rights on file. Names are for the marketer only. Empty until `supabase/009_athletes.sql` has run and the engine has synced rosters. |
| `trigger_queue` | Moments to act on now: matching the brand's triggers (or, with none, big moments for its standout teams), not yet drafted, sent or skipped, with how long each keeps. The default takes ordinary wins in weekly sports (NFL, college football, Premier League) but not in sports with a game most days. |
| `recent_moments` | What just happened for the brand's teams, or any team. |
| `upcoming_games` | Games coming up for those teams, in the fans' time zone, with pre-game moments. |
| `match_products` | The brand's products in a team's colors. |
| `get_territory` | A team's fans as a Klaviyo segment: one to three "Someone's proximity to a location" circles on real postal codes (postcode districts for UK clubs, which also get their district list), the segment ready for Klaviyo's `create_segment`, coverage, and how many of the brand's customers live there. `reach: "wide"` adds shared markets. |
| `build_campaign` | Subject lines, preview text, a finished email (Klaviyo HTML with `{% unsubscribe %}` and the address tags), products with links and prices, the audience, the send time (now, or 8 AM local after a late finish), copy rules and the Klaviyo steps. Takes a `moment_id`, or a team and `moment_type` for a sample. |
| `create_trigger`, `list_triggers`, `delete_trigger` | The brand's rules for which moments matter. |
| `log_send`, `send_history` | What the brand drafted, sent or skipped, with the Klaviyo campaign id. Logged moments leave the queue. |

Operators also get the onboarding tools above.

**Hometown moments** (docs/hometown.md): when someone from a town near a
brand's customers wins a title or a tournament, or decides a playoff game
at the very end, the town gets its own moment. `trigger_queue` and
`recent_moments` (`scope`: teams, towns or both) list the towns near the
brand's customers, with the customers estimated in each town's circle;
`create_trigger` takes `towns` and `min_local_customers`; and
`build_campaign` makes the town's campaign (`town` for a sample,
`radius_miles` to change the circle). Team queries never include them.
`WALKOFF_HOMETOWN=0` takes them out of members' tools, which then don't
mention them; operators keep them, to test.

There are two prompts: `set_up_brand` ("Set up your brand") runs the setup
below, and `moment_campaign` runs the whole campaign loop. The server
instructions tell Claude the setup steps, the flow, the copy rules and where
the help center is (and, for operators, how to onboard a brand).

**The Klaviyo side.** Claude drafts with Klaviyo's own connector (its remote
MCP server, `https://mcp.klaviyo.com/mcp`, signed in as the marketer). The
tools the drafting steps name are in `KLAVIYO_TOOLS` (`lib/mcp/campaign.ts`).
Each audience carries `klaviyo_segment`, the segment in the shape
Klaviyo's `create_segment` takes (one `profile-postal-code-distance`
condition per circle, ORed in one group, three-letter country codes). The
first time a team's segment is missing, Claude offers to create it and does
once the marketer says OK; `klaviyo_segment_steps` is the same segment as
steps, for doing it by hand. Every later moment reuses it. Klaviyo's
proximity condition reads only the district of a UK postcode ("SW1W", not
"SW1W 0NY"), so club circles are centered on one.
Sending or scheduling waits for the marketer's go-ahead. The marketer's
guide to all of this is [/help/klaviyo](https://www.walkoff.io/help/klaviyo).

**Tracking and results.** Walkoff adds no pixel and no tracking of its own:
its emails are ordinary Klaviyo campaigns, so the brand's own tracking sees
them. The drafting steps have Claude turn on the campaign's UTM tracking
with the account's own parameters, which Shopify, Google Analytics and
Triple Whale read, and every campaign's name starts with "Walkoff ·". For
results, Claude takes the campaign ids from `send_history` and reads each
campaign's recipients, clicks, orders and revenue with Klaviyo's
`get_campaign_report`. Walkoff stores none of it. The marketer's side is
[/help/klaviyo#tracking](https://www.walkoff.io/help/klaviyo#tracking).

## Setting a brand up

The marketer connects Walkoff and Klaviyo in Claude and asks "Set up
Walkoff for <brand>", or picks the `set_up_brand` prompt. Claude follows
the Setup steps in Walkoff's instructions (`lib/mcp/server.ts`). The
Shopify connector is optional: on a live onboarding, a marketer on a Team
plan couldn't get it working, and nothing needed it.

1. **`import_catalog`**, the only required step. Walkoff reads
   `<store>/products.json` itself, 250 products a page
   (`lib/affinity/storefront.ts`), with no connector, and turns each
   product into the rows a Shopify product export has. So `parseCatalog`
   reads it exactly as it reads an upload: colors from the Color option,
   SKUs, photos, descriptions. It saves with `saveCatalog` as
   `shopify_store`, and the engine's Claude pass tags the new products.
   Each product's own photo goes in `brand_products.image`
   (`supabase/015_product_image.sql`). Without that column the products
   still save, without photos, and the result carries a `warning` saying
   how many photos were skipped (the server log names the migration to
   run). With a catalog the brand is ready for campaigns: `build_campaign`,
   `match_products`, `get_territory`, `upcoming_games` and `create_trigger`
   (with teams named) all work. Licensed brands often pick teams straight
   from their catalog. `list_brands` drops `setup_needed` here.
2. **The fan map, recommended and optional.** It adds standout teams and
   lift; without it, the default rule has no standouts to watch, so
   Claude asks which teams matter and makes a trigger for them
   (`trigger_queue` says so too). Two ways in:
   - **A Klaviyo profile export (the default).** The marketer exports the
     list or segment they send campaigns to as a CSV, with Email, Zip Code
     and Country, and drops it in step 1 of the brand's upload page (the
     link is in the welcome email). `detectFormat` reads a file with a
     "Zip Code" column plus "Email" or "Phone Number" as
     `klaviyo_profiles`; `aggregateCustomers` places each profile by its
     "Zip Code", using "Country" when it's there and the code's shape when
     it isn't. The browser keeps only counts per postal area, as for every
     upload. Claude is told not to take the file in chat and not to pull
     profiles with the Klaviyo connector.
   - **Shopify in Claude, only if a Shopify connector is connected.** Two
     ShopifyQL queries with the connector's `run-analytics-query`, which
     only reads. Both are in `SHOPIFYQL` (`lib/affinity/shopify-counts.ts`),
     the one source for the instructions, the prompt and the help page:
     customers by postal code for the top 1,000 codes, and customers by
     state or province. Both count customers with a US, Canadian or UK
     shipping address in the last 365 days, so the second's totals cover
     the same customers the first draws from. Then
     **`import_customer_counts`**, with both results as text rows (a
     header, tabs, quotes or a table are fine). Walkoff cuts each postal
     code to its area (`coarseArea`) and sums codes in the same area. Then
     it spreads each state's remaining customers (its total less those
     already placed) over its areas by population, rounding by largest
     remainder so the counts add up. A state whose codes add up to more
     than its total keeps them all (someone who shipped to two codes counts
     in each). UK customers, and states it can't name, are spread over the
     whole country. It saves through the upload path's own check
     (`parseCustomerUpload`), so only coarse areas are stored, as
     `shopify_analytics`, and redraws the map. The result says how many
     customers were placed by their own postal code.
3. **`get_affinity_map`**, once the map is in, to show the marketer their
   standouts.

**Privacy.** A Klaviyo export never passes through Claude: the browser
reads it and sends only counts per area. On the Shopify route, only counts
pass through Claude. Full postal codes reach Walkoff's server in the
request and are cut to areas in memory: they're
never stored or logged, and no error echoes a row. The tool refuses the
whole input when any row has an "@", more than three parts or a part over
60 characters, or when there are more than 5,000 rows, and nothing is
saved. Claude is told to pass counts only, never to use the Shopify
connector's customer or order tools for this, and never to pull profiles
with the Klaviyo connector.

**Reading the store** (`lib/public-fetch.ts`, which the OAuth client
metadata fetch also uses): https only, the default port, a DNS name (no IP
literal or local name), every address it resolves to public, and each of
up to 3 redirects checked again. A page is capped at 16 MB and 10 seconds,
with one retry for 429, 430, 5xx and network errors. Reading stops at 20
pages (5,000 products) or after 25 seconds, to save inside the route's 60.
A read that stops early saves what it has and says so (`saveCatalog`
never deletes). A password page, a store with no feed, or one that turns
Walkoff away gives a plain message with the upload page as the way in.
DNS can still change between the check and the fetch; only operators set
`store_url`.

**What it doesn't cover.** A map from a Klaviyo export or from Shopify in
Claude has no product counts per area: "what each territory buys" needs a
Shopify orders upload. If Shopify rejects a query, Claude is told to fix
only its syntax and keep its columns, and to page with OFFSET if the
connector returns part of the rows. Stores not on Shopify upload a product
export in step 2 of the upload page.

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
  access, and only invited addresses get a code. Each address gets 10 codes
  and 10 wrong tries an hour at most, counted across sign-ins (by a keyed
  hash of the address, in `oauth_events`), so starting over doesn't reset
  them.
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
