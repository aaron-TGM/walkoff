# Outreach: finding brands and pitching them

Walkoff's own sales pipeline, for operators. It finds stores, checks
whether their own catalog wears their home teams' colors, and pitches the
good ones with a sample campaign built from their products: a private page
at `www.walkoff.io/p/<token>`, linked from a short email you send yourself.

```
Store Leads CSV ─► import ─► score ─► contacts ─► pitch ─► you send it ─► mark
 (stores)          home       public    Apollo,     page +     from your     sent, replied,
                   teams      product   FullEnrich  email      outreach      unsubscribed
                   from HQ    feed      or Clay     draft      inbox
```

All of it runs from `npm run prospects` (`scripts/prospects.ts`), on the
tables in `supabase/012_outreach.sql`. The logic is in `lib/outreach/`.

## Before the first send

1. Run `supabase/012_outreach.sql` in the Supabase SQL editor (after 011).
2. In `.env.local`, set who signs and the postal address every commercial
   email must carry (CAN-SPAM):

   ```bash
   OUTREACH_SENDER="Aaron, founder of Walkoff"
   OUTREACH_ADDRESS="Street, City, ST 00000"
   ```

3. Send from a real inbox on a separate domain, not walkoff.io, at a few
   dozen emails a day. **Never send outreach through Resend**: its policy
   bans cold outreach, and Walkoff's sign-in codes and welcome emails go
   through it, so a closed account would stop people signing in.
4. Start with US brands. CAN-SPAM allows cold business email with an honest
   subject, a postal address and an opt-out honored within 10 business days
   (the draft has the last two). Canada (CASL) mostly needs consent first,
   and the UK adds GDPR duties for named people.
5. The privacy page covers early access requests, not prospect data from
   Store Leads or Apollo. Update it before you store named contacts.

## 1. Import stores

In Store Leads, filter for the stores to pitch: Shopify, United States,
Klaviyo installed (Postscript or Attentive for SMS brands), the Apparel
category, and an estimated sales band. In the export options, set the
multiple value separator to `|` (app names can contain colons) and Cluster
Domains to one domain per merchant.

```bash
npm run prospects -- import storeleads.csv --separator "|" --dry-run   # look first: no keys needed
npm run prospects -- import storeleads.csv --separator "|"
```

Store Leads doesn't publish its column names, so the import finds each
field by the names exports use and prints which column it read each one
from. If one is wrong or missing, point it at the right column:
`--column region="HQ State"`. Importing the same store again refreshes it.
A blank cell never erases what an earlier file said, and the status and
score stay as they are.

Each store gets its **home teams**: the teams most fans follow where it's
based (Store Leads' coordinates, postal code or city, usually the
headquarters), one per league, two in a shared market (the Rams and the
Chargers). Leagues the site lists as not playing yet (MLB, until Opening Day
2027) are left out. A school counts once. Stores outside the US, Canada and
the UK have none, and are skipped.

## 2. Score them

```bash
npm run prospects -- score --limit 200        # new stores, four at a time
npm run prospects -- score --only frostbuddy.com
npm run prospects -- score --rescore          # every store not yet written to
```

Scoring reads each store's public product feed (`/products.json`, the
first 1,000 products) and picks what `build_campaign` would feature for each
home team: the colorways closest to the team's colors, one per color. The
score, 0 to 1, is how good that three-product email would look. Each slot
counts its color match, half without a photo. Stores at **0.6** or more are
`qualified`; the rest are `skipped`, with the reason (`show` has it).

Only common color names count here ("Azure Heather", "Navy"). Fanciful ones
("Dune", "Cove") wait for Claude in onboarding, so some good stores score
low. Picks go by color alone: most prospects have no license, and a team tag
from the rules is a guess until Claude checks it.

## 3. Find the people

```bash
npm run prospects -- list --status qualified
npm run prospects -- show frostbuddy.com
```

Look up the qualified stores' founder or whoever owns email (Founder, Head of
Retention, Lifecycle or Email Marketing, CMO) in Apollo, FullEnrich or Clay.
Store Leads' own emails are shared inboxes like info@, so they aren't used.
Then:

```bash
npm run prospects -- contacts apollo.csv --source apollo
```

People are filed under the store their company domain (or work address)
belongs to. Addresses the tool marks undeliverable, and anyone on the
do-not-contact list, are left out.

## 4. Pitch

The morning after a home-team win is the moment:

```bash
npm run prospects -- pitch frostbuddy.com                 # the store's best team
npm run prospects -- pitch frostbuddy.com --team Rams     # another team
npm run prospects -- pitch frostbuddy.com --moment <id>   # a particular moment
npm run prospects -- pitch frostbuddy.com --sample        # their next win, not the last one
```

Without `--moment`, it takes the team's latest win from the last 72 hours,
or else pitches the next one. It prints the page link, a preview link,
who it's to, and the email:

> The Chargers won last night. Walkoff picks up wins like that about a
> minute after the final whistle and builds the email from your catalog.
> Here's Frost Buddy's, for customers in Chargers territory: (link)
>
> Your products in their colors, no license needed, and nothing sends
> without your OK. Want to try it on the next win? It's free for 60 days.

The page shows the campaign `build_campaign` makes for a brand without a
license: their products in the team's colors, the city and never the team,
the audience in its territory and when it would have gone out. It's saved
with the pitch, so it never changes. Try one at `www.walkoff.io/p/demo`.

Everything the email and the page say must be true today, like the site
(`lib/site-copy.test.ts` checks this code too).

## 5. Track it

```bash
npm run prospects -- mark <link> sent          # after you send it: the store is "contacted"
npm run prospects -- mark <link> replied
npm run prospects -- mark <link> unsubscribed  # the address, or with none on file the store's domain, on the do-not-contact list for good
npm run prospects -- mark <link> bounced       # the address on the do-not-contact list
npm run prospects -- status frostbuddy.com trial --note "Starts Monday"
npm run prospects -- block sam@frostbuddy.com --reason "Asked"
```

- **Views:** each open of the page in a browser counts (`show` lists them).
  Open your own check with `?preview=1` so it doesn't count.
- **Signups:** the page's early access form comes filled in with the brand
  and its site, and the request arrives tagged `utm_source=outreach`,
  `utm_campaign=<team key>` and `utm_content=<pitch id>`, in the `waitlist`
  table and the signup email.
- **Statuses:** `new` → `qualified` or `skipped` → `contacted` → `replied`
  → `trial` → `customer`, or `lost`. Scoring never moves a store you've
  written to.

## Not yet

- A morning list in Claude: operator tools that match overnight wins to
  qualified stores and draft each email in your outreach inbox with the
  Gmail connector, for you to send.
- Follow-ups, and replies read from the inbox instead of marked by hand.
- Claude naming fanciful colors at scoring time, for the best stores.
