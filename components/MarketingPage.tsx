import Image from "next/image";
import Link from "next/link";
import { AgentConsole } from "@/components/AgentConsole";
import { BrandSpan } from "@/components/BrandSpan";
import { Eyebrow } from "@/components/Eyebrow";
import { HometownExample, TeamExample } from "@/components/ExampleEmail";
import { FaqItem } from "@/components/FaqItem";
import { PricingPicker } from "@/components/PricingPicker";
import { RESULT, ResultCard } from "@/components/ResultCard";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import { Ticker } from "@/components/Ticker";
import { TriggerCategory } from "@/components/TriggerCategory";
import { Swatches } from "@/components/upload/AffinityReportView";
import { WaitlistForm } from "@/components/WaitlistForm";
import { CONNECTOR_STEPS, CONNECTOR_URL } from "@/lib/connect";
import { TOUR_FACTS } from "@/lib/help/moments";
import { helpPath } from "@/lib/help/pages";
import { mapHighlights } from "@/lib/help/samples";
import { HOME_ASKS } from "@/lib/help/tools";
import { hometownLive } from "@/lib/hometown/flag";
import { LEAGUES } from "@/lib/leagues";
import { teamByKey } from "@/lib/mcp/teams";
import { SEND_HOURS } from "@/lib/mcp/timing";
import { MOMENT_CATEGORIES, MOMENT_STATUS_LABEL } from "@/lib/moments";
import { territoryName } from "@/lib/outreach/pitch";
import { PRICING } from "@/lib/pricing";
import { TRIGGER_CATEGORIES, TRIGGERS } from "@/lib/triggers";

const AUDIENCES = [
  {
    title: "Brands without a license",
    body: "Your customers have a team. When it wins, show up in its colors with products you already sell.",
  },
  {
    title: "Licensed brands",
    body: "Team products in front of the fans who buy the minute their team wins.",
  },
  {
    title: "Golf, surf, tennis and racing brands",
    body: "Your sport has no home team. It has hometowns. When someone from a town near your customers wins, that town gets its own campaign.",
  },
  {
    title: "Agencies",
    body: "One setup that works across every brand you run.",
  },
];

const STEPS = [
  {
    title: "Connect your store in Claude",
    who: "You",
    body: "Connect Walkoff, Shopify and Klaviyo in Claude. Walkoff reads your products, and customer counts by area from Shopify's analytics. No exports. Never a customer list.",
    visual: (
      <>
        <span className="c">{"// what reaches Walkoff"}</span>
        <br />
        <span className="k">country</span>,<span className="k">area</span>,
        <span className="k">customers</span>
        <br />
        <span className="v">US</span>,<span className="v">921</span>,
        <span className="v">212</span>
        <br />
        <span className="v">CA</span>,<span className="v">M5V</span>,
        <span className="v">96</span>
      </>
    ),
  },
  {
    title: "Get your fan map",
    who: "Walkoff",
    body: "Walkoff finds the team territories that hold more of your customers than population predicts, then matches your products and colorways to each team.",
    visual: (
      <>
        <span className="k">chargers_territory</span>:{" "}
        <span className="v">2.4×</span>
        <br />
        <span className="k">packers_territory</span>:{" "}
        <span className="v">1.8×</span>
        <br />
        <span className="k">in_their_colors</span>:{" "}
        <span className="v">&quot;azure heather&quot;</span>
      </>
    ),
  },
  {
    title: "Moments land in your queue",
    who: "Walkoff, 24/7",
    body: "When a team on your map wins big, the moment is in your queue in Claude about a minute after the final whistle.",
    visual: (
      <>
        <span className="k">moment</span>:{" "}
        <span className="v">&quot;walkoff_win&quot;</span>
        <br />
        <span className="k">team</span>:{" "}
        <span className="v">&quot;chargers&quot;</span>
        <br />
        <span className="k">products</span>: <span className="v">3</span>
      </>
    ),
  },
  {
    title: "You approve, Klaviyo sends",
    who: "You",
    body: "Claude drafts the campaign in your Klaviyo account, with the audience and the send time. You look it over and hit send.",
    visual: (
      <>
        <span className="k">status</span>:{" "}
        <span className="v">&quot;drafted&quot;</span>
        <br />
        <span className="k">waiting_on</span>:{" "}
        <span className="v">&quot;you&quot;</span>
        <br />
        <span className="k">via</span>: <span className="v">&quot;klaviyo&quot;</span>
      </>
    ),
  },
];

// The demo brand's map (/upload/demo): two standouts near home, two it
// wouldn't have guessed.
const MAP = mapHighlights(2, 2).map((g) => {
  const team = teamByKey(`${g.league}:${g.teamId}`);
  return { key: `${g.league}:${g.teamId}`, territory: team ? territoryName(team) : g.teamName, lift: g.lift, customers: Math.round(g.customers), pick: g.picks![0] };
});

// 21 -> "9 PM", 8 -> "8 AM"
const hour = (h: number) => `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`;

// "golf (PGA Tour, …), tennis (…), racing (…) and surfing (…)"
const tourList = TOUR_FACTS.map((t) => `${t.sport.toLowerCase()} (${t.tours})`);
const TOURS_LINE = `${tourList.slice(0, -1).join(", ")} and ${tourList.at(-1)}`;

const CONTROLS = [
  {
    title: "Approval first",
    body: "Every message waits for your yes. You see the moment, the audience and the message before anything sends.",
  },
  {
    title: "Never your whole list",
    body: "Each campaign goes to one segment: customers in that team's territory, or a circle around one town.",
  },
  {
    title: "Send timing",
    body: `Each send is timed for your fans' time zone. A game that ends after ${hour(SEND_HOURS.latest)} waits for ${hour(SEND_HOURS.earliest)}, never 2 AM.`,
  },
  {
    title: "Smart Sending on",
    body: "Klaviyo's Smart Sending stays on, so nobody who just heard from you gets another email.",
  },
  {
    title: "Copy rules",
    body: "Without a license, copy never names the team, league, event or any athlete. Your products in their colors do the talking.",
  },
  {
    title: "Skip any moment",
    body: "Not every win fits your brand. Skip it and it leaves your queue, or set triggers so only the moments you want show up.",
  },
];

const PROOF_POINTS: { title: string; body: string; soon?: true }[] = [
  {
    title: "Tracked where you already look",
    body: "Every send is a Klaviyo campaign with UTM tracking on, so Klaviyo, Shopify, Google Analytics and Triple Whale all see it. No new pixel.",
  },
  {
    title: "Revenue per moment",
    body: "Ask Claude how your sends did. It reads each one's orders and revenue from Klaviyo, so you can see what each walk-off, comeback or derby brought in.",
  },
  {
    title: "Holdout groups",
    body: "A random slice of every audience doesn't get the message, so you see what the moment added, not just who clicked.",
    soon: true,
  },
];

export function MarketingPage() {
  const hometown = hometownLive();
  return (
    <>
      <SiteNav />
      <Ticker />

      {/* ─── HERO ────────────────────────────────────────────── */}
      <section className="hero">
        <div className="container-w">
          <div className="hero-grid">
            <div>
              <Eyebrow>Sports moments &middot; Ready in Klaviyo</Eyebrow>
              <h1>
                Their team wins.
                <span className="script">Your campaign&apos;s ready.</span>
              </h1>
              <p className="hero-sub">
                <BrandSpan /> watches every game. When a team wins, your Klaviyo
                campaign is ready: your own products in its colors, for the
                customers who live in its territory. No license needed. Nothing
                sends until you say so.
              </p>
              <div className="hero-actions">
                <a href="#form" className="btn-primary" data-cta="hero">
                  <span>Get early access</span>
                </a>
                <Link href="/p/demo" className="btn-ghost">
                  <span>See a sample campaign</span>
                </Link>
              </div>
              <div className="hero-note">
                {PRICING.trialDays} days free &middot; No credit card &middot;{" "}
                <span className="inline-block">In Claude, with Shopify and Klaviyo</span>
              </div>
              <p className="hero-proof">
                <span className="hero-proof-badge">Early test</span>
                <span>
                  {RESULT.brand}: {RESULT.sends} win emails, {RESULT.revenue} in
                  revenue.{" "}
                  <a href="#proof">See the test</a>
                </span>
              </p>
            </div>

            <div className="moment-card moment-card-hero" aria-label="A real email: Vuori's own catalog in gold and blues">
              <div className="moment-card-final">
                <span>Real email</span>Vuori, used with permission
              </div>
              <div className="moment-card-meta">
                Gold and blues, all from Vuori&apos;s own catalog
              </div>
              <div className="moment-card-email">
                <div
                  className="moment-card-scroll"
                  tabIndex={0}
                  aria-label="The Vuori email, scrollable"
                >
                  <Image
                    src="/examples/vuori-email.jpg"
                    alt="Vuori's email: Kore shorts in Brass, a gym bag, socks and a hat in Bay Blue and Foggy Blue, all from its own catalog."
                    width={654}
                    height={1858}
                    priority
                    sizes="(min-width: 880px) 440px, 92vw"
                    className="moment-card-shot"
                  />
                </div>
              </div>
              <div className="moment-card-foot">
                No logo. No license. Your catalog, in their colors.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── LEAGUES ─────────────────────────────────────────── */}
      <div className="league-strip">
        <div className="container-w league-strip-inner">
          <div className="league-strip-group">
            <span className="league-strip-label">Every game in</span>
            <ul className="league-strip-list">
              {LEAGUES.map((l) => (
                <li key={l.id}>
                  {l.name}
                  {l.note ? <span className="league-strip-note">{l.note}</span> : null}
                </li>
              ))}
            </ul>
          </div>
          <div className="league-strip-group">
            <span className="league-strip-label">Plus hometown moments from</span>
            <ul className="league-strip-list">
              {TOUR_FACTS.map((t) => (
                <li key={t.sport}>{t.sport}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* ─── WHO ─────────────────────────────────────────────── */}
      <section className="block" id="who">
        <div className="container-w">
          <div className="block-num">
            <span className="eyebrow-dot" aria-hidden />
            Who it&apos;s for
          </div>
          <h2 className="section-title section-title-stack">
            If your customers have a team, <em>you have a trigger.</em>
          </h2>
          <div className="audience-grid">
            {AUDIENCES.map((a, idx) => (
              <div key={a.title} className="audience-card">
                <div className="audience-num">0{idx + 1}</div>
                <div className="audience-title">{a.title}</div>
                <p className="audience-body">{a.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FOUNDER ─────────────────────────────────────────── */}
      <section className="block border-t border-rule" id="why">
        <div className="container-w">
          <div className="founder-grid">
            <figure className="founder-quote">
              <div className="block-num">
                <span className="eyebrow-dot" aria-hidden />
                Why we built it
              </div>
              <blockquote>
                <p>
                  The biggest opportunity is brands that will never have a
                  license. Say the Chargers win. That night, an athleisure brand
                  sends an email built from its own catalog: the powder blues,
                  the golds, the pieces that feel like game day.{" "}
                  <em>
                    It ties the brand to the moment and gives the message a real
                    reason to exist.
                  </em>
                </p>
              </blockquote>
              <figcaption className="founder-name">
                Aaron <span>Founder, Walkoff</span>
              </figcaption>
            </figure>

            <TeamExample />
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─────────────────────────────────────── */}
      <section className="block border-y border-rule bg-paper" id="how">
        <div className="container-w">
          <div className="block-num">
            <span className="eyebrow-dot" aria-hidden />
            How it works
          </div>
          <h2 className="section-title">
            Set it up in Claude. <em>Then ask what to send.</em>
          </h2>
          <p className="section-lead">
            During early access we set up your brand and invite your team.
            Everything else happens in Claude, with your Shopify and Klaviyo
            connectors.{" "}
            <Link href={helpPath("onboarding")} className="section-lead-link">
              See every step
            </Link>
          </p>
          <ol className="how-grid how-grid-4">
            {STEPS.map((s, idx) => (
              <li key={s.title} className="how-step">
                <div className="how-step-num">
                  &mdash; 0{idx + 1} &middot; {s.who}
                </div>
                <div className="how-step-title">{s.title}</div>
                <p className="how-step-body">{s.body}</p>
                <div className="how-step-visual">{s.visual}</div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ─── CONTROL ─────────────────────────────────────────── */}
      <section className="block" id="control">
        <div className="container-w">
          <div className="block-num">
            <span className="eyebrow-dot" aria-hidden />
            You&apos;re in control
          </div>
          <h2 className="section-title">
            You approve. <em>Every send.</em>
          </h2>
          <div className="control-grid">
            {CONTROLS.map((c) => (
              <div key={c.title} className="control-card">
                <div className="control-title">{c.title}</div>
                <p className="control-body">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PROOF ───────────────────────────────────────────── */}
      <section className="block border-y border-rule bg-paper" id="proof">
        <div className="container-w">
          <div className="proof-grid">
            <div>
              <div className="block-num">
                <span className="eyebrow-dot" aria-hidden />
                Proof
              </div>
              <h2 className="section-title">
                Results you can <em>defend.</em>
              </h2>
              <p className="section-lead">
                Every moment you draft, send or skip is logged, and every send
                shows up in the tracking you already use.{" "}
                <Link href={helpPath("klaviyo", "tracking")} className="section-lead-link">
                  How tracking works
                </Link>
              </p>
              <ul className="proof-list">
                {PROOF_POINTS.map((p) => (
                  <li key={p.title}>
                    <span className="proof-check" aria-hidden>
                      &rarr;
                    </span>
                    <div>
                      <div className="proof-title">
                        {p.title}
                        {p.soon && <span className="proof-soon">Coming</span>}
                      </div>
                      <p className="proof-body">{p.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <ResultCard />
          </div>
        </div>
      </section>

      {/* ─── AFFINITY ────────────────────────────────────────── */}
      <section className="dark-block" id="affinity">
        <div className="container-w">
          <div className="block-num block-num-dark">
            <span className="eyebrow-dot" aria-hidden />
            Your fan map
          </div>
          <h2 className="section-title section-title-stack">
            Day one, you learn{" "}
            <em>something new about your customers.</em>
          </h2>
          <p className="section-lead section-lead-dark">
            Connect your Shopify store in Claude and Walkoff shows which team
            territories hold more of your customers than population predicts,
            then matches your products to each team, down to the colorway. Each
            standout is a segment you can email the next time that team wins.
          </p>
          <div className="affinity-grid">
            {MAP.map((a) => (
              <div key={a.key} className="affinity-card">
                <div className="affinity-lift">{a.lift}&times;</div>
                <div className="affinity-group">{a.territory}</div>
                <div className="affinity-customers">
                  {a.customers.toLocaleString("en-US")} customers
                </div>
                <div className="affinity-match">
                  <span>On a win, feature</span>
                  <Swatches hex={a.pick.hex} />
                  {a.pick.title} &middot; {a.pick.colorway}
                </div>
              </div>
            ))}
          </div>
          <p className="affinity-foot">
            A sample brand&apos;s map. {MAP[0].lift}&times; means{" "}
            {MAP[0].lift} times more of its customers live in{" "}
            {MAP[0].territory} than population alone would predict.
          </p>
          <div className="affinity-actions">
            <Link href="/upload/demo" className="btn-primary">
              <span>See the whole map</span>
            </Link>
            <span className="affinity-actions-note">No file needed</span>
          </div>
        </div>
      </section>

      {/* ─── MOMENTS ─────────────────────────────────────────── */}
      <section className="block" id="moments">
        <div className="container-w">
          <div className="block-num">
            <span className="eyebrow-dot" aria-hidden />
            Moments
          </div>
          <h2 className="section-title">
            The moments <em>worth an email.</em>
          </h2>
          <p className="section-lead">
            Wins, walk-offs, comebacks, rivalry games, titles and big signings,
            from every game Walkoff watches. Each one lands in your queue in
            Claude, most urgent first.{" "}
            <Link href="/status" className="section-lead-link">
              See the engine live
            </Link>
          </p>

          <div className="trigger-library">
            <div className="trigger-library-head">
              <div className="trigger-library-title">Team moments</div>
              <div className="trigger-library-count">
                {TRIGGERS.filter((t) => !t.coming).length} live,{" "}
                {TRIGGERS.filter((t) => t.coming).length} coming &middot; every
                brand gets all of them
              </div>
            </div>
            <div className="trigger-section">
              {TRIGGER_CATEGORIES.map((cat) => (
                <TriggerCategory
                  key={cat.id}
                  categoryId={cat.id}
                  label={cat.label}
                  items={TRIGGERS.filter((t) => t.category === cat.id)}
                  defaultOpen={cat.id === "after"}
                />
              ))}
            </div>
          </div>

          {hometown ? (
            <div className="hometown">
              <div>
                <div className="hometown-eyebrow">Hometown moments</div>
                <h3 className="hometown-title">
                  Someone from town wins. <em>The town celebrates.</em>
                </h3>
                <p className="hometown-body">
                  When someone from a town near your customers wins a title, a
                  tournament or a race, or wins a playoff game at the very end,
                  that town gets its own moment, if enough of your customers
                  live there. The email goes to a circle around the town, never
                  your whole list, and it celebrates the town. It never names or
                  describes the athlete.
                </p>
                <ul className="hometown-sources">
                  <li>Titles</li>
                  <li>Playoff game-winners</li>
                  {TOUR_FACTS.map((t) => (
                    <li key={t.sport}>{t.sport}</li>
                  ))}
                </ul>
                <Link href={helpPath("moments", "hometown")} className="section-lead-link">
                  How hometown moments work
                </Link>
              </div>
              <HometownExample />
            </div>
          ) : null}

          <div className="moments-next">
            <span className="moments-next-label">On the way</span>
            {MOMENT_CATEGORIES.filter((c) => c.status !== "now").map((c) => (
              <span key={c.id} className="moments-next-item">
                {c.name}
                <span className={`category-badge category-badge-${c.status}`}>
                  {MOMENT_STATUS_LABEL[c.status]}
                </span>
              </span>
            ))}
          </div>
          <p className="moments-next-note">
            Every new category comes with your plan as it launches.
          </p>
        </div>
      </section>

      {/* ─── RED BAND ────────────────────────────────────────── */}
      <section className="red-band" aria-label="Why timing matters">
        <div className="container-w">
          <p className="red-band-line">
            The first brand in the inbox
            <span>owns the moment.</span>
          </p>
        </div>
      </section>

      {/* ─── MCP ─────────────────────────────────────────────── */}
      <section className="dark-block" id="mcp">
        <div className="container-w">
          <div className="mcp-grid">
            <div>
              <div className="block-num block-num-dark">
                <span className="eyebrow-dot" aria-hidden />
                Works in Claude
              </div>
              <h2 className="section-title">
                Ask what to send. <em>Get the campaign.</em>
              </h2>
              <p className="section-lead section-lead-dark">
                Walkoff runs inside Claude, next to the Shopify and Klaviyo
                connectors your team already uses. Ask in plain words. Walkoff
                finds the moment and builds the campaign, your Klaviyo
                connector drafts it, and you hit send.
              </p>
              <div className="mcp-asks-label">Ask Claude</div>
              <ul className="mcp-asks">
                {HOME_ASKS.map((a) => (
                  <li key={a}>
                    <span aria-hidden>&rsaquo;</span>
                    {a}
                  </li>
                ))}
              </ul>
              <div className="code-block">
                <span className="c">{`# Claude: ${CONNECTOR_STEPS}`}</span>
                {"\n"}
                <span className="s">{CONNECTOR_URL}</span>
              </div>
              <ul className="mcp-notes">
                <li>
                  <span className="mcp-notes-badge">Early access</span>
                  Invited brands sign in with their work email. Ask us for an
                  invite.
                </li>
                <li>
                  The engine watches every game around the clock, so the
                  moment is already in your queue when you open Claude.
                </li>
                <li>
                  Every tool, and what to ask it:{" "}
                  <Link href={helpPath("tools")}>Tools and asks</Link>.
                </li>
                <li>
                  Using Claude Code?{" "}
                  <Link href={helpPath("connect", "claude-code")}>Here&apos;s the command</Link>.
                </li>
              </ul>
            </div>
            <div className="mcp-console">
              <AgentConsole />
            </div>
          </div>
        </div>
      </section>

      {/* ─── INTEGRATIONS ────────────────────────────────────── */}
      <div className="integrations-bar">
        <div className="container-w">
          <div className="integrations-label">Plugs into your existing stack</div>
          <div className="integrations-row">
            <div className="integration-item">
              <Image
                src="/klaviyo-new-logo.png"
                alt="Klaviyo"
                width={120}
                height={30}
                className="integration-logo"
              />
              <span className="integration-badge integration-badge-live">
                Live
              </span>
            </div>
            <div className="integration-item">
              <div className="integration-name">Shopify</div>
              <span className="integration-badge integration-badge-live">
                Live
              </span>
            </div>
            <div className="integration-item">
              <div className="integration-name">Claude</div>
              <span className="integration-badge integration-badge-live">
                Live
              </span>
            </div>
            <div className="integration-item">
              <Image
                src="/postscript_logo.svg"
                alt="Postscript"
                width={189}
                height={59}
                unoptimized
                className="integration-logo integration-logo-postscript"
              />
              <span className="integration-badge integration-badge-progress">
                In progress
              </span>
            </div>
            <div className="integration-item">
              <Image
                src="/attentive_logo.svg"
                alt="Attentive"
                width={186}
                height={32}
                unoptimized
                className="integration-logo"
              />
              <span className="integration-badge integration-badge-progress">
                In progress
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── PRICING ─────────────────────────────────────────── */}
      <section className="block" id="pricing">
        <div className="container-w">
          <div className="block-num">
            <span className="eyebrow-dot" aria-hidden />
            Pricing
          </div>
          <h2 className="section-title section-title-stack">
            One flat price per brand. <em>Everything included.</em>
          </h2>
          <p className="section-lead">
            Pick your leagues. Hometown moments, every trigger and everything
            we build next come with it.
          </p>
          <div className="pricing-layout">
            <PricingPicker />
            <div className="pricing-side">
              <div className="pricing-side-card pricing-side-dark">
                <div className="pricing-tier">&mdash; Agencies</div>
                <div className="pricing-side-h">Running several brands?</div>
                <p className="pricing-side-p">
                  One onboarding, one bill, every brand on its own fan map.
                  Tell us how many brands you run and we&apos;ll price it.
                </p>
                <a href="mailto:hello@walkoff.io?subject=Walkoff%20for%20agencies" className="btn-primary">
                  <span>Talk to us</span>
                </a>
              </div>
              <div className="pricing-side-card">
                <div className="pricing-tier">&mdash; Every plan</div>
                <ul className="pricing-side-list">
                  <li>{PRICING.trialDays} days free</li>
                  <li>No credit card to start</li>
                  <li>One flat price, whatever your list size</li>
                  <li>Cancel anytime</li>
                  <li>
                    Save {PRICING.annualDiscount * 100}% when you pay yearly
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FORM ────────────────────────────────────────────── */}
      <section className="block border-y border-rule bg-paper" id="form">
        <div className="container-w">
          <div className="form-grid">
            <div>
              <div className="block-num">
                <span className="eyebrow-dot" aria-hidden />
                Early access
              </div>
              <h2 className="form-left-title">
                Founding brands <em>go first.</em>
              </h2>
              <p className="form-left-body">
                We set up your brand and invite your team. Connect Shopify in
                Claude and your fan map is ready in minutes. Then we set up
                your first triggers with you.
              </p>
              <ul className="form-perks">
                <li>
                  <span className="form-perks-check">✓</span>
                  Setup done for you
                </li>
                <li>
                  <span className="form-perks-check">✓</span>
                  Your fan map in minutes
                </li>
                <li>
                  <span className="form-perks-check">✓</span>
                  Approval on every send
                </li>
                <li>
                  <span className="form-perks-check">✓</span>
                  {PRICING.trialDays} days free, no credit card
                </li>
              </ul>
            </div>

            <div>
              <WaitlistForm />
            </div>
          </div>
        </div>
      </section>

      {/* ─── FAQ ─────────────────────────────────────────────── */}
      <section className="block" id="faq">
        <div className="container-narrow">
          <div className="block-num">
            <span className="eyebrow-dot" aria-hidden />
            FAQ
          </div>
          <h2 className="section-title">
            Questions <em>people actually ask.</em>
          </h2>

          <FaqItem num="01" question="Who is Walkoff for?" defaultOpen>
            Brands whose customers have a team, and especially brands that
            will never have a sports license. When a team wins, Walkoff
            features your own products in its colors, so you show up for the
            moment without a logo. When someone from a town near your
            customers wins a title, a tournament or a race, that town gets
            its own campaign. Licensed brands and agencies too.
          </FaqItem>
          <FaqItem num="02" question="Do we need a sports license?">
            No. Without one, campaigns never name a team, league, player,
            stadium or event. They nod with the colors, and the city for pro
            teams, through your own products. Licensed brands can name their
            teams, within the license.{" "}
            <Link href={helpPath("campaigns", "copy-rules")}>The copy rules</Link>
          </FaqItem>
          <FaqItem num="03" question={<>Does <BrandSpan /> send the messages?</>}>
            Your email platform does, from your own account. Walkoff builds
            the campaign, Claude drafts it in Klaviyo with your connector, and
            you send it. Your deliverability, unsubscribes and suppression
            rules stay exactly as they are.
          </FaqItem>
          <FaqItem num="04" question="What do I need to use it?">
            Claude with your Shopify and Klaviyo connectors. During early
            access we set up your brand and invite your team. Ask Claude to set
            Walkoff up from your store, and your fan map is ready in minutes.
            Then ask what to send, review the campaign, and Claude drafts it
            in your Klaviyo account.{" "}
            <Link href={helpPath("onboarding", "what-you-need")}>What you need</Link>
          </FaqItem>
          <FaqItem num="05" question="Do I have to upload anything?">
            No. On Shopify, Claude sets your brand up with the Shopify
            connector: Walkoff reads your products from your store, and
            Claude reads customer counts by postal code from Shopify&apos;s
            analytics. Walkoff keeps only the area and the count. No names,
            no emails, no street addresses. Not on Shopify? A private upload
            page reads your exports in your browser and sends only counts.
          </FaqItem>
          <FaqItem num="06" question="Will it look like our brand?">
            It features your products, with their photos, prices and links,
            your brand&apos;s name at the top and a stripe in the team&apos;s
            colors. Claude drafts it in your Klaviyo account, so you can edit
            it there like any campaign before it goes out. Or ask Claude for
            another subject line, product or offer.
          </FaqItem>
          <FaqItem num="07" question="How often will we email?">
            As often as you choose. By default your queue gets the big
            moments for your standout teams: walk-offs, comebacks, rivalry
            wins, playoff runs, titles, and wins in sports that play once a
            week. An ordinary win in a sport that plays most days doesn&apos;t
            make the cut, so nobody hears from you after every game. Skip
            anything, make your own triggers, and Klaviyo&apos;s Smart Sending
            stays on.
          </FaqItem>
          <FaqItem num="08" question="How fast do moments show up?">
            About a minute after the final whistle for games. Golf, tennis
            and racing results take a few minutes, and surfing usually a few
            hours. Nothing sends until you say so.{" "}
            <Link href="/status">Watch the engine live</Link>
          </FaqItem>
          <FaqItem num="09" question="Which sports are covered?">
            Every game in the NFL, NBA, NHL, NCAA football and basketball, and
            the Premier League, with MLB from Opening Day 2027. For hometown
            moments, Walkoff also follows {TOURS_LINE}. Need something else?
            Ask. It&apos;s usually quick to add.
          </FaqItem>
          <FaqItem num="10" question="What's a hometown moment?">
            When someone from a town near your customers wins a title, a
            tournament or a race, or wins a playoff game at the very end, that
            town gets its own moment. It reaches you when enough of your
            customers live there. The email goes only to customers in a circle
            around the town, and it celebrates the town. It never names or
            describes the athlete.{" "}
            <Link href={helpPath("moments", "hometown")}>Hometown moments</Link>
          </FaqItem>
          <FaqItem num="11" question="How do I see what it earned?">
            Every Walkoff send is an ordinary Klaviyo campaign with UTM
            tracking on, so Klaviyo, Shopify, Google Analytics and Triple Whale
            all see it. Ask Claude how your sends did, and it reads each
            one&apos;s recipients, clicks, orders and revenue from Klaviyo,
            using your own attribution settings. Coming next: holdout groups,
            so you see what each moment added, not just what it was credited
            with.
          </FaqItem>
          <FaqItem num="12" question="Is my data safe?">
            Walkoff never sees a customer list. It keeps counts by postal
            area, from Shopify&apos;s analytics through Claude or from your
            exports in your browser, so there are no names, emails or
            addresses to leak. Walkoff never asks for your Klaviyo or Shopify
            keys: your own connectors in Claude do the work. Each
            brand&apos;s data is walled off from every other brand&apos;s.{" "}
            <Link href={helpPath("data-and-safety")}>Data and safety</Link>
          </FaqItem>
          <FaqItem num="13" question="What does it cost?">
            ${PRICING.firstLeague} a month per brand, including one league.
            Each extra league is ${PRICING.extraLeague}, and every league
            together is ${PRICING.allLeagues}. Hometown moments come with
            every plan, and so does every trigger, category and feature we
            ship. {PRICING.trialDays} days free, no credit card.
          </FaqItem>
          <p className="faq-more">
            More answers, from setup to sending, in the{" "}
            <Link href={helpPath("help")}>help center</Link>.
          </p>
        </div>
      </section>

      {/* ─── FINAL CTA ───────────────────────────────────────── */}
      <section className="final-cta">
        <div className="container-narrow">
          <div className="final-cta-script">
            <Image
              src="/walkoff_logov3.png"
              alt="WALKOFF."
              width={1539}
              height={367}
              className="prefooter-logo"
            />
          </div>
          <h2 className="final-cta-h">Be first to the moment.</h2>
          <div className="final-cta-actions">
            <a href="#form" className="btn-primary" data-cta="final">
              <span>Get early access</span>
            </a>
            <a href="mailto:hello@walkoff.io" className="btn-ghost">
              <span>Ask a question</span>
            </a>
          </div>
          <p className="final-cta-foot">
            No credit card &middot; {PRICING.trialDays} days free &middot; We
            do the setup
          </p>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
