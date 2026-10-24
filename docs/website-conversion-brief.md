# Walkoff website brief: positioning, conversion and trust

**For:** Claude Code, working in this repo (`aaron-TGM/walkoff`, Next.js 15 on Vercel).
**Decision owner:** Aaron. Items marked **[F#]** need his answer. Each has a default you can ship with (section 13).
**Basis:** www.walkoff.io and this repo at `bb959f8`, rendered at 1440×900 and 390×844 on Oct 24, 2026, merged with the ChatGPT brief of Oct 23, 2026. Where the two disagree, this file makes the call.
**Baseline:** at `bb959f8`, `npm test` (221 pass), `npx tsc --noEmit`, `npm run lint` and `npm run build` are all clean. Keep them that way.

---

## 1. The call, in ten lines

1. **Keep the look. Change the promise.** The brand system is distinctive and right. The page reads like a spec for AI developers, and the buyer is a marketer.
2. **New hero:** "Their team wins. / *Your campaign's ready.*" "The moment engine" becomes the eyebrow and stays in the footer, where it started.
3. **Show the real email.** The product already builds a sample campaign at build time (`lib/help/samples.ts`) for the help center. Put it on the homepage. Don't invent one.
4. **Proof near the top, rewritten to survive a skeptic.** The section is titled "Results you can defend." The card under it isn't defensible yet.
5. **One CTA label everywhere:** "Get early access." There are five different labels today.
6. **Link the demo and close its loop.** `/upload/demo` shows a visitor their own fan map with nothing uploaded. The homepage never links to it, and the demo has no next step after the map.
7. **Fix what's no longer true.** FAQ 07 and FAQ 08 are stale, FAQ 04 contradicts /onboarding, and the pricing card promises "done-for-you approvals."
8. **Measure first.** The site has no analytics at all. Add cookieless analytics and store each signup's source before the redesign ships.
9. **Fix the cheap trust leaks.** There's no favicon and no share image, and the "60 days free · No credit card" lines are 2.25:1 contrast.
10. **Cut what doesn't sell to this buyer:** the Claude Code CLI command, four "Soon" category cards, the local-business card, and Status in the main nav.

---

## 2. Who we're selling to, and how they read the page today

**Primary buyer:** the person who owns email revenue at a DTC brand on Shopify and Klaviyo (email or lifecycle manager, ecommerce director, brand marketing lead). Their customers cluster in a few sports markets, and they usually have no team license. For early access, their team already uses Claude or is willing to.
**Secondary:** licensed brands, and agencies running several Klaviyo brands.

**Their questions, in order:** What is it? Is it for a brand like mine? What exactly do I get? Will it embarrass us or annoy our list? What's the work for my team? Does it make money? What does it cost? What happens after I sign up?

**How that buyer reads the page today**, on a phone, from a shared link. "Screens down" is the section's offset ÷ 844px.

| Screens down | What they see | What they think |
|---|---|---|
| Link preview | No image. "The moment engine for brands and their AI agents." | Another AI tool. |
| 0 | That headline, four lines tall. The sub ends "One MCP connection plugs it into Claude or any AI agent." | What does it do for me? Is this for developers? |
| 1 | Dark console of tool calls (`walkoff.get_affinity_map`, …) | Technical. There's a subject line at the end. |
| 2.0 | Who it's for: four cards, one of them bars and restaurants | Is this for me, or for a sports bar? |
| 3.3 | Founder quote, and the "Powder blue kind of Sunday." email card | **This is the aha.** It arrives four screens in. |
| 8.3 | Moments: four of five category cards say Next or Soon | Is this mostly roadmap? |
| 10.6 | MCP section with a `claude mcp add` command | Not for me. |
| 13.0 | "You approve. Every send." | Good. I needed to hear this much earlier. |
| 14.4 | "$5,689 in 7 minutes." An average click rate beside best-send revenue. "Free Lid Win." beside "No discount." | Seven minutes of what? This looks cherry-picked. |
| 16.6 | Pricing picker, $149 | Fair. |
| 18.8 | Seven-field form. Success: "We'll be in touch within 24 hours." No links. | Now I wait. |

The sticky nav keeps "Early access" one tap away, so reaching the form isn't the problem. **The order of persuasion is.** The aha, the reassurance and the proof all arrive late, and the technology arrives first. The page is 20,168px on mobile (about 24 screens) and 11,718px on desktop.

**What's working, and stays:**
- the visual identity
- the founder quote ("The biggest opportunity is brands that will never have a license")
- "You approve. Every send."
- the transparent pricing picker
- the red band ("The first brand in the inbox owns the moment.")
- "Be first to the moment."
- the help center
- the repo's discipline about only claiming what's true

---

## 3. ChatGPT's brief: what holds up

**Overall:** it diagnoses the right problem and is careful about claims. But it was written without the code, so:
- it assumes things that aren't there (analytics)
- it proposes building things that already exist (a campaign example, "not sure" form states, reduced-motion support)
- it misses the repo's guardrails
- its proposed copy is generic, and in two places it breaks house rules

| ChatGPT said | Call | Why |
|---|---|---|
| Lead with the marketer's campaign and the opportunity; explain the technology after | **Keep** | The right diagnosis. |
| Price matters less than doubts about relevance, setup and ongoing work | **Keep** | Its best insight. It drives the FAQ and the How it works changes. |
| H1 "Give your customers another reason to buy." | **Reject** | Could be any promo tool. It drops sports and the voice. |
| Fallback H1 "Turn sports moments into your next email campaign." | **Reject as H1** | Clear but flat. The idea moves into the sub and the title tag. |
| Eyebrow "Sports-driven email campaigns for ecommerce brands" | **Modify** | Use "The moment engine · Sports first" to keep the founder's ownable name. |
| CTA "Get 60 days free" | **Reject** | Signup is a request followed by hand onboarding, not instant access. Use "Get early access", with the trial terms underneath. |
| An ungated example as the secondary CTA | **Keep** | It points to the new `#example` section. |
| Build a fictional apparel brand and basketball comeback with the subject "Keep the good night going." | **Reject** | The product already generates a real sample: a Chargers walk-off for Sample Athleisure Co. Help already shows it, and the demo matches it. Real beats invented, and its copy ("What a finish.") is better. |
| One coherent scenario; label illustrations as such | **Keep** | Also fix the current collisions (section 9). |
| Say "customers in this team's territory," not "fans," for numbers | **Keep** | Mostly done already. Fix the hero sub and one console row. |
| Put proof directly under the hero | **Keep** | As one compact line in the hero. The full card stays in `#proof`. |
| Question "7 minutes," the free-lid offer, and average vs best send | **Keep, extend** | Replace best-send revenue with the all-sends figure (about $0.36). |
| Proof title "A sports-moment campaign in practice." | **Reject** | Doesn't match the brand voice. |
| Make the Claude and Klaviyo requirement visible | **Keep** | This also fixes FAQ 04 contradicting /onboarding. |
| Cut the form to email, website and platform; make leagues and teams optional; allow "Not sure yet" | **Mostly done already** | Only four fields are required. Leagues and teams are optional, the placeholder says "not sure yet," platform has "Other / not sure," and values survive an error. `company` is NOT NULL in the database. Keep the form and tune it. |
| Success copy "You're on the list. Check your inbox…" | **Reject** | No email goes to the lead today, so "check your inbox" would be false. "On the list" reads like a queue. Keep "You're in." |
| Don't promise a response time you can't keep | **Keep** | See [F3]. |
| Never require a call | **Keep** | |
| Break-even illustration and calculator | **Reject** | More code for a hypothetical number. The real test result does this job. |
| MLB availability as P0 | **Downgrade to P2** | The engine watches MLB, the postseason ends within days, and plans start on Opening Day 2027. One wording fix covers it. |
| Label SMS and roadmap items | **Already done** | "In progress" and "Coming" badges exist. |
| "Use the site's existing analytics system" | **Wrong premise** | There is none. Installing it is P0, with secret upload links redacted. |
| Respect reduced motion | **Already done** | `app/globals.css:2099`. The ticker still needs a pause control. |
| Title "Walkoff \| Sports-Driven Email Campaigns for Ecommerce" | **Modify** | The site uses "·" and sentence case. |
| Proposed copy "…the campaign—ready for your team to review." | **Reject** | Em dash. The site removed them in May, and tests ban them in help pages and emails. |
| Not covered: favicon and share image, the demo, stale FAQs, offer-line contrast, the copy-truth test | **Added here** | |

---

## 4. Brand guardrails (apply to every change)

**Visual system.** Use what exists. No new UI libraries, icon sets or fonts.
- **Tokens** (`tailwind.config.ts`):
  - `cream` for the page and `paper` for alternate sections.
  - `ink` for headings, `inkMuted` for body text (5.2:1 on cream).
  - `inkFaint` for decoration only (2.25:1 on cream). Never use it for text a buyer needs.
  - `rule` for dividers.
  - `red` for the brand and the primary CTA, plus `redDeep`.
  - `mustard` for Next and Coming badges, `grass` for live and success.
- **Type:** Arbeit for display and body. Amerik Slant for the wordmark and the second beat of headlines (`.script` in the h1, `<em>` in `.section-title`). JetBrains Mono for eyebrows, labels, buttons, badges and code.
- **Patterns:**
  - `.block` sections with a `.block-num` eyebrow and red dot, and two-beat headlines
  - offset-shadow cards (`10px 10px 0`) and `.dark-block` sections
  - skewed `.btn-primary`, `.btn-ghost` and `.btn-green` buttons
  - the `layout` breakpoint at 880px
- **Dependencies:** the only new one allowed is `@vercel/analytics`.

**Voice.**
- Two beats, the second in script: "You approve. *Every send.*"
- Short declaratives. Concrete nouns: products, colorways, territories, send times.
- Sports words used precisely (walk-off, derby, buzzer beater, final whistle). No sports clichés about marketing ("slam dunk," "home run ROI," "game-changer").
- Plain words for marketers. MCP, tool names and CLI commands appear only where the reader opted in: the Claude section and the help center.
- No em or en dashes in copy, and no exclamation marks. Use a middot (·) between items in mono labels.
- Write sentence case; CSS uppercases headings and buttons. "Walkoff" in the hero's running text uses `<BrandSpan />`.

**Truth.**
- **Every claim must be true today.** `lib/site-copy.test.ts` fails the build on known false claims. When you remove a stale claim, add its phrase to `UNTRUE` so it can't come back.
- **Roadmap items get a badge** (Coming, Next, In progress), never the present tense.
- **Label examples as examples:** "Sample feed," "Example session," "Example map," "Sample brand." Label real results with brand, date and source.
- **Nothing fabricated:** no logos, testimonials, counters, scarcity or benchmarks you don't have. "14 spots remaining" was removed in May for this reason.
- **Audience numbers describe geography:** "customers in Chargers territory," not "Chargers fans."
- **Copy rules:**
  - Sample customer-facing creative for an unlicensed brand never names the team, league, players, stadium or event.
  - Team names are fine in explanation written for the marketer; the footer disclaimer covers it.
- **Facts come from code where code has them:** `PRICING`, `LEAGUES`, `SEND_HOURS`, `HELP_TOOLS` asks, `sampleCampaign()`. Don't hardcode a value a constant already holds.

**One example world.**
- The brand is Sample Athleisure Co.: no license, Southern California.
- The team is the Chargers. The colorways are Azure Heather, Sunflower and Gold.
- The subject line is "Azure and sunflower kind of Sunday." The audience is customers within 25 miles of 92108.
- Other teams appear only in the ticker and the fan map, to show breadth, with numbers that don't collide.

---

## 5. Positioning and hero

**The five-second test.** From the first screen, a target buyer should be able to say:
- It turns sports moments into ready Klaviyo campaigns.
- It's for brands whose customers have teams, and no license is needed.
- I get a drafted campaign with my own products.
- Nothing sends without me.
- The next step is early access, 60 days free.

**Hero copy** (`components/MarketingPage.tsx:206-239`):

| Element | Copy |
|---|---|
| Eyebrow | The moment engine · Sports first |
| H1 | Their team wins. |
| H1 `.script` | Your campaign's ready. |
| Sub | `<BrandSpan />` watches every game and turns the big moments into ready-made Klaviyo campaigns: your own products in the team's colors, for the customers who live in its territory. You work in Claude. Nothing sends without your go-ahead. |
| Primary | Get early access → `#form` |
| Ghost | See a sample campaign → `#example` |
| Note | 60 days free · No credit card · We do the setup · Then from $149/mo (build it from `PRICING`) |
| Proof line | `Early test` badge · Frost Buddy: 7 win-triggered emails, $5,689 in revenue. · See the test → `#proof` |

The sub adapts the clearest sentence in the codebase, from the welcome email (`lib/welcome.ts:39`), with "fans" changed to territory language. The proof line sits in the copy column under the note, so it's on the first desktop screen and close to the first phone screen. Style it with `.result-card-badge`.

**Hero visual** (`components/AgentConsole.tsx`). Keep the console: it's the honest picture of a product that runs in Claude. Change the ending.
- After the `build_campaign` line, show a mini email inside the console:
  - an azure and sunflower stripe
  - "YOUR BRAND"
  - "What a finish."
  - three swatch tiles with product names
  - a "Shop the colors" button
- Then: "Drafted in Klaviyo · waiting for your go-ahead."
- Line 10: "Arsenal fans, UK" → "Arsenal territory, UK".
- Final score time: `SUN 4:41P`, to match the sample's timing.
- Optional, below 880px: hide the `upcoming_games` and `match_products` lines so the console is shorter on phones.

**[F1] Aaron picked the current headline on Oct 23** (commit `4719673`: "The footer's line becomes the headline"). It's a good name and a weak promise. It tells a brand manager what Walkoff is, not what they get, and "AI agents" asks them to learn a concept before they've seen a campaign. Keep it as the name: in the eyebrow, and unchanged as the footer tagline. Let the H1 do the selling.
- **Default:** change the headline.
- **If vetoed:** keep the H1, and still ship the new sub, CTAs, note, proof line and console ending.

**Headline to test later**, once analytics has a baseline: "If your customers have a team, / *you have a trigger.*" (currently the `#who` headline).

---

## 6. Page architecture

**Nav** (`components/SiteNav.tsx:5-12`):
- Links: Example · How it works · Pricing · FAQ · Help.
- CTA: "Get early access", shortened to "Early access" on narrow screens as today.
- Status moves to the footer only (it's already there).
- Moments and MCP stay reachable by scrolling and by anchor.

**Order:**

| # | Section | Buyer question it answers | Change |
|---|---|---|---|
| 0 | Ticker | Is this live? | Fix the number collision; add a pause control |
| 1 | Hero | What is it, and is it for me? | New copy; proof line; console ends on the email |
| 2 | League strip | Which leagues? | MLB note wording (P2) |
| 3 | `#example` | What exactly do I get? | **New**, built from `sampleCampaign()` |
| 4 | `#who` | Will it work for a brand like mine? | Founder quote plus three cards; the moment card and local-business card go |
| 5 | `#how` | What's the work for my team? | Who does each step; what you'll need |
| 6 | `#affinity` | What do I learn on day one? | Demo CTA; readable footnote |
| 7 | `#control` | Will it embarrass us? | Moved up; copy unchanged |
| 8 | `#moments` | Which moments? | Future categories collapse to one line; "After the game" opens by default |
| 9 | Red band | Why now? | Unchanged |
| 10 | `#mcp`, renamed "Works in Claude" | How does my team use it? | Example asks replace the tool cards; the CLI command moves to help; the integrations row moves here |
| 11 | `#proof` | Can I defend the results? | Card rewritten |
| 12 | `#pricing` | What does it cost? | Copy fixes |
| 13 | `#form` | What happens next? | Labels, attribution, success-state links |
| 14 | `#faq` | What could stop us? | Rewritten as 12 questions |
| 15 | Final CTA and footer | | CTA label; add a Demo link to the footer |

Keep these anchors: `#how`, `#moments`, `#mcp`, `#pricing`, `#form`, `#faq`. Help pages, the footer and emails link to them.

---

## 7. Section specs

### 7.1 Ticker (`components/Ticker.tsx`)
- Line 5 says "2,310 customers in Eagles territory," the same figure the Chargers use everywhere else. Change it to a number used nowhere else.
- Pause the ticker on hover and on `:focus-within`, and add a small visible pause/play button (WCAG 2.2.2). Keep the reduced-motion rule.

### 7.2 `#example` (new): "From final score *to finished email.*"
- **Eyebrow:** One moment, start to finish
- **Lead:** "What Walkoff builds when the Chargers win, for a sample athleisure brand with no license. Same code and rules as your campaigns. The copy never names the team: your products in its colors do the talking."
- **Left column: a five-step rail.** Pull every value from `sampleCampaign()` and `SAMPLE_TEAM` in `lib/help/samples.ts`; don't retype them.
  1. **The moment:** a Chargers walk-off win (sample).
  2. **The audience:** customers within 25 miles of 92108, saved once as a Klaviyo segment (`audience.circles`, `audience.segment_name`).
  3. **The products:** three picks with swatches (`products`).
  4. **The words:** the three subject lines and the preview text.
  5. **Your call:** "Claude drafts it in your Klaviyo account with Smart Sending and UTM tracking on. Edit it, schedule it or skip it." Then the send line, from `send.send_at_local` and `send.why`.
- **Right column: the email**, in an offset-shadow frame: `<iframe srcDoc={sampleEmailHtml()} sandbox="" loading="lazy" title="Sample email">`. Reuse the `.help-email` sizing (`globals.css:1887-1897`), or extract the shared part.
- **Caption:** "Sample brand and moment, built by Walkoff's campaign code. Not a customer result."
- **CTA under it:** Get early access (placement `example`).
- **Build:** a server component, `components/ExampleCampaign.tsx`, rendered at build time like the help pages, so no geo data reaches the browser. The rail doubles as the text alternative to the iframe.

### 7.3 `#who`: keep "If your customers have a team, *you have a trigger.*"
- Show the founder quote verbatim, beside or above three cards in this order: Brands without a license, Licensed brands, Agencies.
- Remove the moment card (`MarketingPage.tsx:304-326`). `#example` replaces it.
- **[F8]** Remove the Local businesses card (`MarketingPage.tsx:33-36`) and mention local shops in FAQ 1 instead. It dilutes the ecommerce story, and the workflow (Shopify exports, Klaviyo, Claude) is built for DTC brands. Default: remove.

### 7.4 `#how`: keep "Four steps. *We set them up for you.*"
- Show who does each step, like the `who` tags on /onboarding:
  - 01: You
  - 02: Walkoff
  - 03: Walkoff, around the clock
  - 04: You
- Add one line under the lead, linked to `/onboarding#what-you-need`: "You'll need: Claude with your Klaviyo connector · a Shopify or Klaviyo export · your product export."
- Optional, below 880px: hide the code visuals. They're decorative and add about 600px of scrolling.

### 7.5 `#affinity`: keep the headline
- Add a CTA row: `.btn-primary` "Try it with your own export" → `/upload/demo` (placement `affinity_demo`), with the helper text "Nothing leaves your browser in the demo."
- `.affinity-foot` is 3.5:1 contrast at 9.6px. It's the honest definition of lift, so make it readable: at least 4.5:1 and about 12px.
- Label Arsenal the same way the console does.

### 7.6 `#control`: move it up and change nothing. It's the best answer to buyer worries on the page.

### 7.7 `#moments`: keep "Sports first. *Then everything that moves your customers.*"
- Keep the Sports card. Replace the four future cards with one line of small badges: "Weather · Next · Local events · Soon · Holidays & culture · Soon · Trends · Soon." Follow it with "Every new category is included in your plan as it launches."
- In the trigger library, open "After the game" by default. Add a `defaultOpen` prop to `components/TriggerCategory.tsx`, which hardcodes `useState(false)` at line 51.
- Soften trigger descriptions in `lib/triggers.ts` that state performance as fact:
  - 38: "Best re-engagement of the year." → "The re-engagement moment every fan base shares."
  - 52: "Highest real-time engagement of any trigger." → "Fans are glued to the game."
  - 73: "Timing is the conversion lever." → "Timing is everything."
  - 94: "Strong cart recovery and lapsed buyer angle." → "A natural angle for lapsed buyers and open carts."
  - 108: "…converts well." → "Consolation angle: a soft tone and a small offer." This matches the angle the product itself uses.
- Add a "See the engine live" link to `/status`.

### 7.8 `#mcp`, renamed "Works in Claude"
- **Eyebrow:** Works in Claude.
- **H2:** "Ask what to send. *Get the campaign.*"
- **Lead:** "Walkoff runs inside Claude, next to the Klaviyo and Shopify connectors your team already uses. Ask in plain words. Walkoff finds the moment and builds the campaign, your Klaviyo connector drafts it, and you hit send."
- **Asks:** replace the eight tool cards with four example asks, styled like the help `Ask` block and sourced from `HELP_TOOLS` so `help.test.ts` keeps them real: `trigger_queue.asks[0]`, `build_campaign.asks[1]`, `get_territory.asks[0]`, `send_history.asks[1]`.
- **Connector:** keep the connector address with a copy button (`CopyLine`). Move the `claude mcp add` lines out and link "Using Claude Code?" → `/help/connect#claude-code`.
- **Notes:**
  - "Early access: invited brands sign in with their work email."
  - "Built on MCP, the open standard for AI agents."
  - "Every tool, and what to ask it: Tools and asks."
- **[F6]** The site claims Walkoff works with "any AI agent," but only Claude and Claude Code are documented. Default: say "Built on MCP" and make no compatibility claim.
- Move the integrations row (`MarketingPage.tsx:600-657`) to the end of this section, unchanged.

### 7.9 `#proof`: keep "Results you can *defend.*" Rewrite `components/ResultCard.tsx`.

| Element | Now | New (defaults until [F2] confirms) |
|---|---|---|
| Badge | Early test | Early test · {Month} 2026 |
| Meta | Frost Buddy · MLB · Win triggers | Same |
| Title | 7 teams. 7 win-triggered emails. | Same |
| Headline | $5,689 in 7 minutes. | $5,689 in revenue. |
| Tile 1 | 16K · Recipients · 7 team segments | Same |
| Tile 2 | 6.7% · Click rate · Avg across 7 sends | Same |
| Tile 3 | $0.52 · Rev / recipient · Best single send | $0.36 · Rev / recipient · Across all 7 sends |
| Footer | "Free Lid Win." No discount. Just the right email at the right moment. | The offer: "Free Lid Win." Revenue as Frost Buddy's Klaviyo attributed it. |
| Bridge (new) | | MLB is back on Opening Day 2027. The same win triggers run today for the NFL, NBA, NHL, college and the Premier League. |

$0.36 is $5,689 ÷ 16,000. If the true recipient count is anywhere from 15,500 to 16,500, the figure is $0.34 to $0.37, so use the exact count once you have it. Keep "in 7 minutes" only if [F2] explains it in a footnote.

### 7.10 `#pricing`
- `components/PricingPicker.tsx:12`: "Done-for-you setup, triggers and approvals" → "Setup done for you during early access." Approvals belong to the marketer.
- Line 86: change the CTA to "Get early access," with "60 days free. No credit card." under it.
- Add "One flat price, whatever your list size" to the every-plan list. It's true per `lib/pricing.ts`.
- **[F7]** What happens at day 60? Default: say nothing beyond "60 days free, no credit card."
- Raise `.pricing-billed` contrast. It carries the annual price.

### 7.11 `#form` (`components/WaitlistForm.tsx`)
- **Field changes:**
  - Perks: "Done for you, start to finish" → "Setup done for you." The marketer still reviews and sends.
  - Line 98: "Your email" → "Work email."
  - When the selected platform isn't Klaviyo, show inline: "Campaigns draft in Klaviyo today. Postscript and Attentive are in progress. We'll still reply."
  - Submit button (line 222): "Get early access →"
  - Fine print (line 225): keep the text and raise its contrast. **[F3]** Keep "We reply within 24 hours"? Default: keep; it's live now.
- **Success state (lines 65-77):** keep "You're in." and the 24-hour line. Turn "our export guide" into real links:
  - "How to export each file" → `/help/uploads#export`
  - "See a fan map now" → `/upload/demo`
  - "What setup looks like" → `/onboarding`
- **New behavior:** add the hidden attribution fields (section 10.3) and prefill teams from the demo (section 8).
- **Keep:** the honeypot, server validation, the save-or-email fallback in `app/api/waitlist/route.ts`, a single step, no captcha and no required call.

### 7.12 `#faq`: twelve questions, in the buyer's order
Write the answers in the site's voice and build every number from constants. These drafts have been checked against the code and the help pages.

1. **Who is Walkoff for?** (open by default) Brands whose customers have a team, especially brands that will never have a sports license. When a team wins, Walkoff features your own products in its colors, so you show up for the moment without a logo. Licensed brands and agencies use it too, and so do local shops with a customer list.
2. **Do we need a sports license?** No. Without one, campaigns never name a team, league, player, stadium or event. They nod with the colors, and the city for pro teams, through your own products. [The copy rules](/help/campaigns#copy-rules)
3. **What do we need to use it?** (replaces "What's MCP, and do I need it?") Claude with your Klaviyo connector, a Shopify or Klaviyo export of your customers or orders, and your product export. During early access we set up your brand, build your fan map and tag your catalog. Your team works in Claude: ask what to send, review the campaign, and Claude drafts it in your Klaviyo account. [What you need](/onboarding#what-you-need)
   - **[F4]** If there's a path without Claude, add one sentence. Default: none.
   - **[F5]** Name the supported Claude plans only if confirmed.
4. **What do we upload?** Keep the current FAQ 02, and add: "Try [the demo](/upload/demo) with your own file first. Nothing is uploaded."
5. **Does Walkoff email our customers?** No. Klaviyo does, from your account, when you say so. Walkoff builds the campaign and Claude drafts it with your Klaviyo connector. Your deliverability, unsubscribes, suppressions and Smart Sending stay as they are.
6. **Will the emails look like our brand?** (new) They feature your products, photos, prices and links, with your brand's name at the top and a stripe in the team's colors. The layout is clean and simple. Claude drafts it in your Klaviyo account, so you can edit it there like any campaign before it goes out, or ask Claude in plain words for another subject line, product or offer. **[F13]** Confirm the advice on using the brand's own template.
7. **How often will we email?** (new) As often as you choose. By default your queue fills with big moments for your standout teams: walk-offs, comebacks, rivalry wins, playoff runs, titles, and wins in weekly sports. In daily sports an ordinary win doesn't make the cut, so fans don't hear from you after every game. Make your own triggers, skip any moment, and Klaviyo's Smart Sending stays on. (This matches `DEFAULT_RULE` and the `team_win` description.)
8. **How fast do moments show up?** About a minute after the final whistle, the moment is in your queue in Claude. If a game ends late, the send waits for 8 AM where your customers live. [Watch the engine live](/status) (build the hours from `SEND_HOURS`).
9. **Which leagues are covered?** NFL, NBA, NHL, NCAA football and basketball, and the Premier League. MLB plans start on Opening Day 2027. Need another league? Ask.
10. **How do we see what it earned?** (replaces the stale FAQ 07) Every Walkoff send is an ordinary Klaviyo campaign with UTM tracking on, so Klaviyo, Shopify, Google Analytics and Triple Whale all see it. Ask Claude how your sends did, and it reads each one's recipients, clicks, orders and revenue from Klaviyo, using your own attribution settings. Coming next: holdout groups, so you see what each moment added, not just what it was credited with.
11. **Is our data safe?** (replaces the stale FAQ 08) Walkoff never sees a customer list. Your browser turns your exports into counts by postal area, so there are no names, emails or addresses to leak. Walkoff never asks for your Klaviyo or Shopify keys: your own Klaviyo connector in Claude does the drafting. Each brand's data is walled off from every other brand's. [Data and safety](/help/data-and-safety)
12. **What does it cost?** $149 a month per brand, including one league. Each extra league is $50, and every league together is $399. Pay yearly and save 20%. Every trigger, category and feature we ship is included. 60 days free, no credit card.

### 7.13 Final CTA and footer
- Change the button to "Get early access" and raise the contrast of `.final-cta-foot`.
- The footer tagline stays "The moment engine for brands and their AI agents." Add a Demo link under Product.

---

## 8. Close the demo loop
- **The CTA:** in demo mode, once a report renders (`components/upload/UploadClient.tsx:393-396`), show a CTA block. The button reads "Get early access" and goes to `/#form` (placement `demo`). The copy depends on the source:
  - Map from the visitor's own file: "Your customers have teams. *Now get the campaigns.*" Body: "During early access we set up your brand with your real files and line up your first moments. 60 days free, no credit card."
  - Built-in sample map: "Want this for your brand? *We'll set it up.*" Same body.
- **Prefill the form:** if the map came from the visitor's own file, save the top three standout `teamName`s in `sessionStorage` under `walkoff:demo-teams`, wrapped in try/catch. `WaitlistForm` prefills the Teams field from it on mount, but only if the field is empty.
- **Privacy:** pass team names only, nothing else from the file. Keep them out of the URL so analytics never records them. The demo's promise ("This demo doesn't upload anything at all") must stay true.

---

## 9. Truth pass: fix or remove

| Where | Says now | Problem | Fix |
|---|---|---|---|
| `MarketingPage.tsx:797-803` (FAQ 07) | "Coming next: …each send gets matched to your orders" | Contradicts "Revenue per moment," which is live (`d5b9deb`) | FAQ 10; add "gets matched to your orders" to `UNTRUE` |
| `MarketingPage.tsx:804-809` (FAQ 08) | "…the narrowest API access that works, encrypt keys…" | Walkoff stores no brand API keys in the MCP model | FAQ 11; add "encrypt keys" to `UNTRUE` |
| `MarketingPage.tsx:780-786` (FAQ 04) | "You don't need it… we can run everything for you" | /onboarding lists Claude under "What you need" | FAQ 3 |
| `PricingPicker.tsx:12` | "…triggers and approvals" | The marketer approves sends | 7.10; add "triggers and approvals" to `UNTRUE` |
| `MarketingPage.tsx:723` | "Done for you, start to finish" | The marketer reviews and sends | "Setup done for you" |
| Hero sub | "finds the customers who care" | It finds customers in a team's territory | New sub |
| Hero sub | "…Claude or any AI agent" | Only Claude and Claude Code are documented | [F6] |
| `AgentConsole.tsx:10` | "Arsenal fans, UK" | It's a territory, not proven fandom | "Arsenal territory, UK" |
| `Ticker.tsx:5` | "2,310 … Eagles territory" | Same figure as the Chargers | Use a new number |
| `MarketingPage.tsx:309, 312` | "Ready 2 minutes later"; "Powder blue kind of Sunday." | Doesn't match the queue timing or the real subject line | Removed along with the moment card |
| `ResultCard.tsx` | "in 7 minutes"; best send beside averages; "No discount. Just the right email at the right moment." | Not defensible | 7.9 |
| `lib/triggers.ts` | "converts well," "Highest… engagement" | Performance claims with no data behind them | 7.7 |
| `lib/leagues.ts:25` vs `/status` | MLB "Opening Day 2027" vs "7 leagues monitored live" | Reads as a contradiction | P2: change the note to "Plans from Opening Day 2027" |
| Terminology | "affinity map" (homepage, pricing) vs "fan map" (help, onboarding) | Two names for one thing | **[F9]** Default: "fan map" in public copy; tool names unchanged |
| `app/terms/page.tsx:52` | "Approvals and auto-fire rules" | The product doesn't auto-fire | **Legal: flag only** |
| `app/privacy/page.tsx:103` | "encrypt stored API credentials" | Describes the old model | **Legal: flag only** |

---

## 10. Measurement (P0, before the redesign)

There's no analytics in the code or in the live HTML. Until this ships, every change in this brief is a guess.

### 10.1 Page views
- Add `@vercel/analytics` and render `<Analytics />` in `app/layout.tsx`.
  - It sets no cookies: Vercel identifies visits by a hash of the request and discards it after 24 hours.
  - Vercel is already listed as a processor in `/privacy`.
  - Turn on Web Analytics in the Vercel project settings.
- **Redact secrets in `beforeSend`.** Write it as a pure function in `lib/analytics.ts`, with unit tests:
  - `/upload/<token>` → `/upload/[token]`. Upload links are private to each brand. Leave `/upload/demo` as is.
  - Drop `/oauth/*` events.
  - Strip query parameters except `utm_*` and `ref`.

### 10.2 Events (Pro or Enterprise only)
Vercel's custom events need a Pro or Enterprise plan **[F10]**. If the project has one:

| Event | When | Data |
|---|---|---|
| `cta_clicked` | Any "Get early access" click | `placement`: nav, hero, example, how, pricing, final, demo |
| `example_viewed` | `#example` is 50% in view, once | |
| `demo_opened` | A link to `/upload/demo` is followed | `from` |
| `form_started` | First focus in the form, once | |
| `signup_succeeded` | On the server, in `/api/waitlist` after the save or the notification succeeds (`@vercel/analytics/server`) | `platform`, `role` |
| `signup_failed` | On the client, on error | `kind`: validation, network or server |

Never put emails, company names or free text in events. On the Hobby plan, skip events and rely on 10.3.

### 10.3 Store the lead's source with each signup (works on any plan; this is the source of truth)
- **Migration:** add `supabase/008_waitlist_attribution.sql`. Make it safe to re-run, like 002. Add nullable columns: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `referrer`, `landing_path`, `cta_placement`.
- **Client:**
  - On the first page load of a visit, save the first-touch UTMs, `document.referrer` and the landing path to `sessionStorage`.
  - On each CTA click, save its placement.
  - `WaitlistForm` sends all of these with the signup.
- **API:**
  - Accept only those keys and clip them with the existing `str()`.
  - Add a "Source" block to the notification email.
  - Never reject a signup because of bad attribution data.
- **Ship it safely:** if the insert fails because a column is missing (the migration hasn't run yet), retry once without the attribution fields. The old `klaviyo_key` column made every insert fail; don't repeat that.

### 10.4 Privacy policy
Add one sentence about cookieless Vercel Web Analytics to `/privacy`. It's legal text, so include the sentence in the PR and flag it for Aaron's sign-off.

### 10.5 What to watch
- **Signup rate:** signups (from Supabase) ÷ unique visitors (from Vercel), weekly, by source and device.
- **Engagement:** each CTA placement's share of clicks, example views, demo opens, and demo visits that become signups.
- **Downstream:** signup → brand created → files uploaded → first campaign drafted → paid. This comes from operator data, not the website; `onboarding_status` covers the middle steps.
- **Baseline:** ship PR 1, then wait two weeks before PR 2 if traffic allows (a few hundred visitors). If traffic is lower, don't wait. Ship PR 2 and run a 5-second test with five target buyers: "What does this do, who is it for, and what would you click?"

---

## 11. Sharing, SEO and accessibility (in PR 1)
- **Icons:** `/favicon.ico`, `/icon.png` and `/apple-icon.png` all return 404 today.
  - Add `app/icon.png` (512×512) and `app/apple-icon.png`, made from the runner mark.
  - **[F12]** Aaron supplies the mark. Default: render it from `public/walkoff_logov3.png`.
- **Share image:** add `app/opengraph-image.png` (1200×630).
  - Design: cream background, the wordmark, and "Their team wins. / *Your campaign's ready.*" in the brand fonts.
  - One way to make it: render an HTML template with the site's fonts in Playwright, screenshot it, and commit the PNG.
  - Set `twitter.card` to `summary_large_image`.
- **Title:** Walkoff · Sports moments, ready as Klaviyo campaigns (52 characters).
- **Description:** When their team wins, Walkoff builds your Klaviyo campaign: your own products in the team's colors, for customers in its territory. In Claude. 60 days free. (156 characters)
- **Contrast:**
  - `.hero-note`, `.form-fine`, `.final-cta-foot` and `.pricing-billed` move from `inkFaint` (2.25:1) to `inkMuted` (5.2:1), at 0.75rem or larger.
  - `.affinity-foot` goes to at least 4.5:1.
  - These lines carry the offer, and today they're the hardest text on the page to read.
- **Motion:** give the ticker a pause control, and add `.result-card-badge-dot` to the reduced-motion rule.

---

## 12. PR plan

Each PR ships on its own. Every PR description must list which founder defaults it used.

**PR 1: Truth, trust and measurement.** No layout changes.
- **Files:**
  - Copy: `MarketingPage.tsx` (FAQ 04, 07 and 08, the form perk, CTA labels), `PricingPicker.tsx`, `WaitlistForm.tsx`, `SiteNav.tsx`, `Ticker.tsx`, `AgentConsole.tsx` (the Arsenal label only), `ResultCard.tsx`
  - Styles and metadata: `globals.css`, `app/layout.tsx`, the app icons and share image
  - Analytics and attribution: `lib/analytics.ts` with its test, `app/api/waitlist/route.ts`, `lib/waitlist.ts`, `supabase/008_waitlist_attribution.sql`
  - Guardrails and legal: `lib/site-copy.test.ts`, and `app/privacy/page.tsx` (flagged for sign-off)
- **Done when:**
  - [ ] Tests, `tsc`, lint and build pass.
  - [ ] Redaction tests cover upload tokens, the demo, OAuth and query parameters.
  - [ ] The copy test fails if the stale FAQ phrases return.
  - [ ] Signup works both before and after the 008 migration, and the notification email shows the source.
  - [ ] `curl` shows `og:image`, `summary_large_image` and the icon links.
  - [ ] Every CTA says "Get early access."
  - [ ] No em dashes in new copy.

**PR 2: The story.**
- **Files:** `MarketingPage.tsx` (hero, section order, `#who`), new `components/ExampleCampaign.tsx`, `AgentConsole.tsx`, `SiteNav.tsx`, `SiteFooter.tsx`, `globals.css`.
- **Done when:**
  - [ ] Screenshots at 1440×900 and 390×844 are attached to the PR.
  - [ ] On a phone, the H1, sub, primary CTA and offer note are visible without scrolling, and the proof line is no more than about 1.2 screens down.
  - [ ] "See a sample campaign" lands on `#example`.
  - [ ] The email comes from `sampleEmailHtml()`, with no hand-written email copy.
  - [ ] Every anchor listed in section 6 still works.
  - [ ] `help.test.ts` passes.

**PR 3: The conversion path.**
- **Files:** `UploadClient.tsx`, `WaitlistForm.tsx`, `app/api/waitlist/route.ts`, new `lib/lead-reply.ts` with its test, `MarketingPage.tsx` (FAQ), `PricingPicker.tsx`.
- **Auto-reply to the lead,** through Resend (already set up):
  - From `RESEND_FROM_EMAIL`, with reply-to set to `NOTIFICATION_EMAIL`.
  - Subject: "You're in: next steps for {company}."
  - Body, in the welcome email's voice: what happens next; links to `/help/uploads#export`, `/upload/demo` and `/onboarding`; "Questions? Reply to this email." Signed "Aaron, Walkoff" **[F11]**.
  - Send it after a successful save or notification. A failed send must never fail the request.
  - Only once this ships may the success state add "We sent this to your inbox too."
- **Done when:**
  - [ ] The demo shows the CTA. A map from the visitor's own file prefills Teams; the sample map doesn't.
  - [ ] The auto-reply test checks the links and finds no dashes.
  - [ ] FAQ answers agree with /onboarding and the help pages.

**PR 4: Tighten.**
- **Files:** `MarketingPage.tsx` (`#moments`, `#mcp`), `TriggerCategory.tsx`, `lib/triggers.ts`, `Ticker.tsx`, `lib/leagues.ts`, and the "fan map" wording pass.
- **Done when:**
  - [ ] The mobile page is shorter than today's 20,168px.
  - [ ] The ticker pauses from both keyboard and pointer.
  - [ ] The example asks on the homepage come from `HELP_TOOLS`.
  - [ ] The trigger library's drift test still passes.

---

## 13. Founder inputs (answer before PR 1 if you can; otherwise the defaults ship)

| # | Question | Default |
|---|---|---|
| F1 | Replace the Oct 23 headline? | Yes. The line moves to the eyebrow and stays in the footer. |
| F2 | Frost Buddy: which month; what "7 minutes" measures; the exact recipient count; where the revenue figure comes from and its attribution window; what the offer was; permission to name them | Drop "7 minutes"; use averages; badge "Early test"; name the offer only as "Free Lid Win." |
| F3 | Can you keep "We reply within 24 hours"? | Keep it |
| F4 | Is there a path without Claude during early access? | No; Claude is required |
| F5 | Which Claude plans support the connector for your users? | Don't name plans |
| F6 | Tested with any agent besides Claude and Claude Code? | Say "Built on MCP" only |
| F7 | What happens at day 60? | Say only "60 days free, no credit card" |
| F8 | Drop the Local businesses card? | Yes; mention local shops in FAQ 1 |
| F9 | "Fan map" or "affinity map" in public copy? | Fan map |
| F10 | Is the Vercel project on Pro? | Assume Hobby: page views plus attribution stored in Supabase |
| F11 | Sign the auto-reply as Aaron? | Yes, with reply-to `NOTIFICATION_EMAIL` |
| F12 | Supply a square mark for the favicon? | Render it from the existing logo |
| F13 | Can brands use their own Klaviyo template? | "Edit it there like any campaign" |
| Legal | Terms "auto-fire," privacy "stored API credentials," and the analytics sentence | Flag in the PR description; Aaron edits |

---

## 14. Don't
- Build a fictional example brand or email. Use `sampleCampaign()`.
- Use "Get 60 days free" or "Start free trial" until access is instant.
- Say "check your inbox" before the auto-reply ships.
- Add a calculator, carousel, chat widget, exit popup, countdown or required call.
- Add logos, testimonials, counters, "spots left" or benchmarks you don't have.
- Add cookies, a consent banner or third-party pixels (Meta, GA). Stay cookieless.
- Rename routes, or remove the anchors listed in section 6.
- Change product behavior (MCP tools, the engine) or legal text without sign-off.
- Put team names in sample copy that customers would see.

---

## Appendix A: Evidence (Oct 24, 2026; the live site matches the repo at `bb959f8`)
- **Page height:** 11,718px at 1440×900; 20,168px at 390×844. No horizontal overflow at either size.
- **Section tops, mobile:** who 1,662 · why 2,755 · how 3,836 · affinity 5,437 · moments 7,033 · mcp 8,976 · control 10,994 · proof 12,186 · pricing 14,016 · form 15,836 · faq 17,521.
- **Section tops, desktop:** proof 6,408 · pricing 7,449 · form 8,614.
- **Analytics:** none found in the code or the live HTML. Searched for gtag, GTM, Plausible, PostHog, Segment, `@vercel/analytics`, Clarity, Hotjar, Fathom, Umami, Mixpanel, Amplitude and fbq.
- **Icons and share tags:** `/favicon.ico`, `/icon.png`, `/apple-icon.png` and `/opengraph-image` all return 404. There's no `og:image`, and `twitter:card` is `summary`.
- **Contrast:** `inkFaint` is 2.25:1 on cream and 2.43:1 on paper. `inkMuted` is 5.21:1 and 5.64:1. `.affinity-foot` is 3.50:1.
- **CTA labels today:** "Get Early Access" (nav), "Get Early Access, Free" (hero), "Start 60 days free" (pricing), "Claim Early Access →" (form), "Claim Early Access, Free" (final CTA).
- **Demo:** `/upload/demo` returns 200. It's linked only from `/onboarding` and `/help/uploads`, and has no CTA after the map.
- **Real sample campaign** (`/help/campaigns#sample`):
  - Subject lines: "Azure and sunflower kind of Sunday." / "That finish." / "Right down to the last second."
  - Preview: "The Everyday Jogger in Azure Heather, and more in the colors you're already wearing."
  - Body: "What a finish. Some wins you feel all week."
  - Audience: within 25 miles of 92108.
  - Send: "Right away: fans are still buzzing, and it's a decent hour where they live."
- **MLB:** the engine polls it (`engine/config.ts`, `LEAGUE_RULES.mlb`), the product doesn't restrict brands by league, and the World Series is on now.
- **Guardrails in the repo:**
  - `lib/site-copy.test.ts` bans known false claims.
  - Dash tests: `lib/help/help.test.ts:177`, `lib/welcome.test.ts:81`, `lib/brands.test.ts:380`.
  - "14 spots remaining" was removed in `5803eca`.

## Appendix B: Product notes from the buyer's side (not website work)
- **Brand template.** The email uses a clean generic layout (Helvetica, black button). Brand managers will ask for their own logo, header and footer. A per-brand logo and accent color, or a Klaviyo template ID, would remove the biggest worry after "do we need a license."
- **Holdouts.** Ecommerce directors want to know how much revenue the sends actually added, not just what Klaviyo credits to them. Holdout groups will sell more than benchmarks.
- **Lead follow-up.** After the auto-reply, a day-2 nudge about exports for leads who aren't onboarded yet would shorten the time to their first campaign.
