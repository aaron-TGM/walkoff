# Store Leads: the list of brands to pitch

How Walkoff finds the stores it pitches, step 1 of `docs/outreach.md`.
[Store Leads](https://storeleads.app) is a directory of online stores: each
store's platform, location, installed apps, categories and estimated sales,
updated weekly. This file says which plan to buy, the exact search, and how
to get the list into `npm run prospects`.

**For an agent told "Follow docs/storeleads.md":** go to
[Run an extraction](#run-an-extraction). Use the API path if
`STORELEADS_API_KEY` is set, otherwise the CSV path with a file Aaron
uploads. Never log in to the Store Leads website or drive it with a browser,
and never ask for a password or key in chat.

**Checked** against storeleads.app (pricing on the home page, the help
center, the [API reference](https://storeleads.app/api) and the
[terms](https://storeleads.app/terms)) on November 2, 2026. Anything not
from those pages is labeled.

## The plan to buy

**Pro, $250 a month, for one month at a time.** It's the cheapest plan with
CSV export and API access, and one month covers the first pull with plenty
to spare.

| Plan | Price | What matters here |
|---|---|---|
| Premium | $75/mo | 2,000 searches a month, the web app only. **No CSV export, no API or MCP.** |
| **Pro** | **$250/mo** | Unlimited searches, **CSV export, API and MCP access**, 2 users. |
| Elite | $450/mo | Pro on every platform, not just two. |
| Enterprise | $950/mo | Higher API rate limits, calculated values, product search, historical data. |

Every plan covers "all stores on any 2 ecommerce platforms" (Premium and
Pro; pick Shopify), costs $35 a month per extra user, and cancels any time.
A yearly plan is 15% off. There are no credits or row limits on Pro: an
export can hold every store the search matches. (Third-party reviews said
Premium has no export and Pro has both; storeleads.app confirms it.)

**When:** buy it once the sending inbox is a few days from ready (first
pitches around November 16), so the pull is fresh. In that month:

1. Pull the whole list (below), import it and score the first batches.
2. Save the search as a List, so the next pull is one command.
3. Just before the month ends, pull again for stores that newly match, then
   cancel.

**Refresh** by buying another Pro month when the qualified stores you
haven't written to drop below about 300, or every quarter, whichever comes
first. At a few dozen emails a day one pull lasts months, so a standing
subscription isn't worth it yet. Premium can't refresh anything, since it
can't export.

**Refunds:** Store Leads refunds a renewal you forgot to cancel only if
nothing was exported since that payment (terms 2.c). Any export or API pull
uses that up, so cancel on time.

## Who to pitch

US Shopify brands whose own products can come in a team's colors, that
email their customers with Klaviyo, and are big enough to have a list but
small enough that a founder still reads cold email.

| Filter | Value | Why |
|---|---|---|
| Platform | Shopify | Walkoff reads the public Shopify product feed and builds Klaviyo emails from it. |
| Status | Active | Live stores only. |
| Country | United States | CAN-SPAM. No Canada or UK yet. |
| Installed apps | Klaviyo: Email Marketing & SMS | Campaigns are drafted in Klaviyo. Postscript or Attentive is a bonus, not a filter: `list` shows them. |
| Categories (any of) | the list below | Products that come in colorways: apparel, drinkware and kitchen, home, pets, outdoor, golf, bags. |
| Estimated sales | $25,000 to $1,000,000 a month | Enough to run email; small enough for a founder to read it. |
| Product count | 10 to 5,000 | Enough products for three in a team's colors. The scorer reads the first 1,000. |
| Domain type | Custom domain | Not `shop.myshopify.com`. |
| Tags | not Dropshipper, not Print on Demand | Their catalogs aren't theirs to pitch. |
| Employees | 200 or fewer, when known | Checked after the pull: Store Leads knows headcount for few stores, so filtering on it would drop every store it doesn't know. |
| Sort | Rank, best first | The most visited stores in the band come first. |

**Categories**, as Store Leads names them (its full list is at
storeleads.app/help/faq/list-of-categories). A store is filed under
subcategories ("/Apparel/Athletic Apparel"), so each is named:

- Apparel: `/Apparel`, Athletic Apparel, Casual Apparel, Children's
  Clothing, Clothing Accessories, Eyewear, Footwear, Headwear, Men's
  Clothing, Swimwear, Women's Clothing. Left out: Costumes, Formal Wear,
  Undergarments.
- Drinkware and home (Frost Buddy's kind of store):
  `/Home & Garden/Kitchen & Dining`, its `/Cookware & Diningware`,
  `/Home & Garden/Home & Interior Decor`, `/Home & Garden/Bed & Bath`,
  `/Home & Garden/Yard & Patio`.
- Pets: `/Pets & Animals/Dogs`, `/Pets & Animals/Cats`,
  `/Pets & Animals/Pet Food & Supplies`.
- Outdoor and sport: `/Sports/Sporting Goods`, its `/Outdoors`,
  `/Hiking & Camping` and `/Fishing`, `/Sports/Individual Sports/Golf`,
  `/Sports/Team Sports`, `/Sports/College Sports`.
- Bags: `/Travel/Bags & Luggage`.

The code has the same list (`CATEGORIES` in `lib/outreach/storeleads.ts`).
Change both together.

**Location.** There's no metro filter. Every US city has home teams (an NFL
team and a school at least), and the importer works them out from the
store's coordinates, postal code or city. Stores Store Leads can't place
get no home teams and are never pitched. The dry run counts them.

**How many stores.** An estimate, until the first `count`: Store Leads'
public reports show 180,582 US Shopify stores with Klaviyo, and among all
Klaviyo stores about 30% sell apparel, 13% home and garden, 4% sports and
3% pets. After the categories, the sales band, product count and tags,
expect **roughly 10,000 to 20,000 stores**. The share that scores 0.6 or
more is unknown until the first batches; at 15 to 30%, that's 2,000 to 5,000
qualified stores, many months of pitching. `npm run storeleads -- count`
gives the real number in one request.

### The saved search, in the web app

For Aaron, or anyone exporting by hand. Turn on **Advanced** search on the
Domains page and add each filter:

| Field | Operation | Value |
|---|---|---|
| Platform | Or | Shopify |
| Status | Or | Active |
| Country | Or | United States |
| Installed Apps | Or | Klaviyo: Email Marketing & SMS |
| Category | Or | every category above |
| Estimated Monthly Sales | range | 25,000 to 1,000,000 |
| Products Sold | range | 10 to 5,000 |
| Domain Type | Or | custom domain |
| Tags | Not Or | Dropshipper, Print on Demand |

Sort by Rank. Then click the star at the top of the filters to save it as a
List named **Walkoff · US Shopify Klaviyo colorways**. A saved search is a
dynamic List: it follows the weekly updates. Its id (in the List's URL, or
from the API's List endpoints) lets the API pull exactly the same stores:
`npm run storeleads -- pull --list <id>`.

### The same search, in the API

`lib/outreach/storeleads.ts` (`searchParams`) sends it to List Domains:

```
f:p=shopify
f:cc=US
f:ds=Active
f:an=shopify.klaviyo-email-marketing
f:cat=/Apparel,/Apparel/Athletic Apparel,...   f:cat:op=or
f:ermin=2500000          # $25,000, in cents
f:ermax=100000000        # $1,000,000, in cents
f:pcmin=10  f:pcmax=5000
f:ismy=false
f:tags=Dropshipper,Print on Demand   f:tags:op=not
sort=rank
```

## Export settings (CSV)

In the Export dialog, choose these columns. Names vary, which is fine: the
importer finds each by name and the dry run says which column it read.

- Domain, Merchant Name, Platform
- Country, State, City, Zip/Postal Code, Latitude, Longitude (location)
- Estimated Sales (monthly), Products Sold, Employees
- Categories, Apps (installed apps)

**Don't** choose email addresses, phone numbers or social accounts. Walkoff
keeps store-level data only, and named people come later, from Apollo,
FullEnrich or Clay (`docs/outreach.md` step 3).

Under **Export Options**:

| Option | Setting | Why |
|---|---|---|
| Multiple value separator | `\|` | App names contain colons ("Klaviyo: Email Marketing & SMS"), the default separator. |
| Cluster Domains | Only include a single domain from each merchant | One row per brand, not merchant.com and merchant.ca. |
| Do not include currency symbols | on | Plain numbers. The importer reads `$1,234` too, so either works. |
| Include filtered App install dates | off | Not used. |
| Only include a single email per store | n/a | No email columns. |
| Excel Support | off | The importer strips the byte-order mark anyway. |
| Randomize | off | Keep rank order. |
| Do not add headers | **off** | The importer needs the header row. |

Save the file as `storeleads.csv` in the repo root. `.gitignore` keeps
`storeleads*.csv` out of git: it's licensed data, never committed.

## Run an extraction

### By API (an agent can do this)

Needs `STORELEADS_API_KEY`, from the Account page's API tab on Pro or
higher. In a cloud session, Aaron adds it as an environment variable named
`STORELEADS_API_KEY` in the environment's settings (the environment menu in
the session's title bar, then Edit); a new session picks it up. Locally it
goes in `.env.local`. Never in the repo or the chat.

```bash
npm run storeleads -- count                          # how many stores match: one request
npm run storeleads -- pull --max 50 --out storeleads-test.csv   # a small first look
npm run storeleads -- pull                           # everything, to storeleads.csv
npm run storeleads -- pull --list <id>               # the saved List instead of the built-in search
```

`pull` pages through List Domains 1,000 stores at a time, sorted by rank,
asking only for the fields the importer reads (no contact details). It
keeps one domain per merchant, US stores only, and drops stores known to
have more than 200 employees, then prints what it left out and the import
command. It converts sales from cents to dollars, and writes the state from
`administrative_area_level_1` (the API's `state` is the store's status).

Then import as below, with `--separator "|"`.

### By CSV (Aaron exports, an agent imports)

Aaron runs the saved search, exports with the settings above, and uploads
`storeleads.csv` to the session or puts it in the repo root.

### Import and score

```bash
npm run prospects -- import storeleads.csv --separator "|" --dry-run
npm run prospects -- import storeleads.csv --separator "|"
npm run prospects -- score --limit 500
npm run prospects -- list --status qualified --limit 50
```

Score in batches of about 500 (it reads each store's public product feed,
four at a time, so 500 takes a while). That's roughly 75 to 150 qualified
stores, a week or more of pitching. Score the next batch when the qualified
stores you haven't written to run low. Importing again refreshes stores
already there and never erases what an earlier file said, so a second pull
is safe.

## Check the dry run

The dry run reads the file, places every store and saves nothing. Before
importing, check:

1. **Rows read and kept.** Kept should be close to rows. Many "same store
   twice" means Cluster Domains was left on "all domains".
2. **Each field's column.** It prints each field and the column it came from:
   - `domain`: "Domain" (not "Merchant Name").
   - `region`: "State" or "Administrative Area Level 1". **Never** a column
     of Active or Inactive (the API's `state`) and never "Region" alone
     (Store Leads' region is a continent, "Americas").
   - `monthly_sales`: the estimated sales column.
   - `apps` and `categories`: present. If the five sample stores show
     "messaging: none found", the separator is wrong (`--separator "|"`).
   - `lat`/`lng`: present if exported. Postal codes are known for about 1%
     of stores, so most are placed by coordinates or city.
   - A wrong or missing column: `--column region="HQ State"`.
3. **The five sample stores.** City and state look right, sales look like
   dollars a month (a $25,000 to $1,000,000 band; numbers 100 times bigger
   mean cents slipped through), and each has home teams.
4. **Unplaced stores.** "N of M couldn't be placed" should be a small share.
   They get no home teams and are never pitched.

## Pitfalls

- **Money is in cents in the API** (`estimated_sales`, `f:ermin`,
  `f:ermax`) and in dollars in the web app. `npm run storeleads` converts;
  a hand-made file from the API has to as well.
- **`state` in the API is the store's status**, not a US state. The state
  is `administrative_area_level_1`. The web export's "Region" is a
  continent.
- **Estimated sales are a model's guess**, mostly from traffic (Store Leads'
  help says so). Treat the band as rough; the score is what decides.
- **Employee count and postal code are rare.** Don't filter on them in the
  search: a filter drops every store without the value.
- **Category filters match the exact category.** Name each subcategory, as
  above. If a `count` looks low, check one store's categories in the API.
- **Cursors die at the weekly update** (Store Leads uploads on Sunday or
  Monday, Pacific time). Pull in one sitting, not across it.
- **Rate limits:** List Domains allows 2 requests a second on Pro;
  `cursor=all` and Export Domains, once a minute. A 429 says how long to
  wait (Retry-After) and the script waits it out. Export Domains is
  deprecated.
- **Shopify only, two platforms per plan.** Pro covers the two platforms
  picked after paying (Shopify, plus any). The choice can change after each
  monthly payment.
- **What the terms allow** (storeleads.app/terms):
  - Programmatic access only through the official API (2.a.ix). No scraping
    the web app, no browser automation.
  - No reselling or republishing the data (2.a.vi, vii). Pitch pages show
    the brand's own products, never Store Leads data, and the CSVs stay out
    of git.
  - **No mass mailings or bulk commercial email** with the data (2.i).
    Walkoff's few dozen individually written pitches a day, each with the
    brand's own sample page, fit. A blast to the whole list would not.
  - **Don't mention Store Leads in outside communication without their
    written OK** (2.j). Pitch emails never say where the store was found.
    The privacy page (`/privacy#outreach`) names Store Leads as a source;
    ask Store Leads for written consent, or describe it without the name.
  - One person per seat, employees and contractors of the company only
    (2.e, f). Pro has 2 seats; an agent pulls with Aaron's key, for Walkoff.
- **No people.** Store Leads lists shared inboxes (info@) and social
  accounts. Leave them out of every export and pull. People come from
  Apollo, FullEnrich or Clay, after the privacy policy covers them.
- **US only.** The search pins the country to the US and the pull drops any
  other country. Canada and the UK wait.

## Reference

Facts from storeleads.app for the next person:

- **API:** `https://storeleads.app/json/api/v1/all/...`, with
  `Authorization: Bearer <key>`. No key: 401. JSON everywhere.
- **List Domains:** `GET /domain` (or `POST` with a JSON body). 50 a page
  by default, `page_size` up to 5,000, `cursor` from each response's
  `next_cursor` (with `has_next_page` and `total`). `cursor=all` returns
  everything asynchronously (202, then poll every 5 seconds for the 200);
  `for=jsonl` makes it JSON lines. `fields` limits the response
  (`apps.name` for nested). `sort` by `rank`, `-er,rank` (sales), `pc,rank`
  (products) and more. `aq` takes an advanced search
  (`[{"field":"cat","value":"...","operator":"or"}]`) and can't be mixed
  with `f:` filters.
- **Filters used here:** `f:p` platform, `f:cc` country, `f:ds` status,
  `f:an` app (`shopify.klaviyo-email-marketing`; Postscript is
  `shopify.postscript-sms-marketing`, Attentive `shopify.attentive`),
  `f:cat` category, `f:ermin`/`f:ermax` monthly sales in cents,
  `f:pcmin`/`f:pcmax` products, `f:ismy` myshopify domain, `f:tags`,
  `f:lids` a saved List. Each takes `:op` (`and`, `or`, `not`). Also there:
  `f:administrative_area_level_1` and `f:city` (with `f:cc`), `f:empcmin`,
  follower counts for Pinterest, TikTok, Twitter and YouTube, `q` text.
  A radius around a place is in the web app's Advanced search, not
  documented for the API.
- **Domain fields:** `name`, `merchant_name`, `platform`, `country_code`,
  `administrative_area_level_1`, `city`, `postal_code`, `latitude`,
  `longitude`, `location`, `estimated_sales` (monthly, cents),
  `estimated_sales_yearly`, `product_count`, `employee_count`, `categories`,
  `apps` (objects with `name`, `token`, `installed_at`), `technologies`,
  `contact_info` (emails, phones, social accounts with follower counts:
  not used), `cluster_domains`, `cluster_best_ranked`, `rank`,
  `platform_rank`, `tags`, `retailer_page` (a brand) and `brands_page`
  (a retailer), `state` (status).
- **Other endpoints:** a single domain (`/domain/<name>`), bulk domains, a
  company name to its domains (`/company/<name>`), Lists (read, add,
  remove), apps, technologies. An MCP server at `https://storeleads.app/mcp`
  (Pro or higher) has `search_domains` and `get_domain`, for looking a store
  up in Claude.
- **Data:** updated weekly, uploaded Sundays or Mondays. Notifications and
  webhooks on the Account page say when. 3.2 million live Shopify stores,
  39% in the US.
