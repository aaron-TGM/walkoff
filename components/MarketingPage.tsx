import Image from "next/image";
import Link from "next/link";
import { AgentConsole } from "@/components/AgentConsole";
import { BrandSpan } from "@/components/BrandSpan";
import { Eyebrow } from "@/components/Eyebrow";
import { FaqItem } from "@/components/FaqItem";
import { PricingPicker } from "@/components/PricingPicker";
import { ResultCard } from "@/components/ResultCard";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import { Ticker } from "@/components/Ticker";
import { TriggerCategory } from "@/components/TriggerCategory";
import { Swatches } from "@/components/upload/AffinityReportView";
import { WaitlistForm } from "@/components/WaitlistForm";
import { CONNECTOR_STEPS, CONNECTOR_URL } from "@/lib/connect";
import { helpPath } from "@/lib/help/pages";
import { HOME_TOOLS } from "@/lib/help/tools";
import { LEAGUES } from "@/lib/leagues";
import { MOMENT_CATEGORIES, MOMENT_STATUS_LABEL } from "@/lib/moments";
import { SEND_HOURS } from "@/lib/mcp/timing";
import { PRICING } from "@/lib/pricing";
import { TRIGGERS, TRIGGER_CATEGORIES } from "@/lib/triggers";

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
    title: "Local businesses",
    body: "Bars, restaurants and shops in a sports town with a customer list.",
  },
  {
    title: "Agencies",
    body: "One setup that works across every brand you run.",
  },
];

// The founder's example: a brand with no license, its own catalog, a
// team's colors.
const MOMENT_PICKS = [
  { title: "Everyday Jogger", colorway: "Azure Heather", hex: "2e8bd8" },
  { title: "Sunday Hoodie", colorway: "Sunflower", hex: "ffc512" },
  { title: "Coastal Crew", colorway: "Gold", hex: "ffb81c" },
];

const STEPS = [
  {
    title: "Drop in your exports",
    body: "Your Shopify or Klaviyo export, read right in your browser. Only counts by postal area reach us, plus your product list. Never a customer list.",
    visual: (
      <>
        <span className="c">{"// what leaves your browser"}</span>
        <br />
        <span className="k">area</span>,<span className="k">customers</span>,
        <span className="k">orders</span>
        <br />
        <span className="v">191</span>,<span className="v">212</span>,
        <span className="v">340</span>
        <br />
        <span className="v">532</span>,<span className="v">96</span>,
        <span className="v">121</span>
      </>
    ),
  },
  {
    title: "Get your affinity map",
    body: "Walkoff finds the fan territories your customers lean toward, then matches your products and colorways to each team.",
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
    title: "Moments get matched",
    body: "We watch every game in your leagues and flag the moments your customers care about, from walk-offs to rivalry wins.",
    visual: (
      <>
        <span className="k">moment</span>:{" "}
        <span className="v">&quot;rivalry_win&quot;</span>
        <br />
        <span className="k">where</span>:{" "}
        <span className="v">&quot;North London&quot;</span>
        <br />
        <span className="k">products</span>: <span className="v">3</span>
      </>
    ),
  },
  {
    title: "You approve, Klaviyo sends",
    body: "Claude drafts the campaign in your Klaviyo account, with the audience and the send time. You look it over and send it while the moment is still hot.",
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

const AFFINITY_EXAMPLES = [
  {
    group: "Chargers territory",
    customers: "2,310",
    lift: "2.4×",
    match: "Azure and sunflower colorways",
    swatches: ["2e8bd8", "ffc512"],
  },
  {
    group: "Padres territory",
    customers: "1,880",
    lift: "1.9×",
    match: "Brown and gold colorways",
    swatches: ["2f241d", "ffc425"],
  },
  {
    group: "Packers territory",
    customers: "1,402",
    lift: "1.8×",
    match: "Forest green and gold",
    swatches: ["1e4d2b", "ffb81c"],
  },
  {
    group: "Arsenal, North London",
    customers: "846",
    lift: "1.6×",
    match: "Anything red and white",
    swatches: ["ef0107", "f7f7f5"],
  },
];

// 21 -> "9 PM", 8 -> "8 AM"
const hour = (h: number) => `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`;

const CONTROLS = [
  {
    title: "Approval first",
    body: "Every message waits for your yes. You see the moment, the audience and the message before anything sends.",
  },
  {
    title: "Triggers",
    body: "Pick the moments that matter, like walk-off wins in your top markets. They land in your queue, and you still say go.",
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
    body: "Without a license, copy never names the team, league, players or event. Your products in their colors do the talking.",
  },
  {
    title: "Skip any moment",
    body: "Not every win fits your brand. Skip it and it leaves your queue.",
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
  {
    title: "Benchmarks",
    body: "Compare against brands like yours. We pool results, never customers.",
    soon: true,
  },
];

export function MarketingPage() {
  return (
    <>
      <SiteNav />
      <Ticker />

      {/* ─── HERO ────────────────────────────────────────────── */}
      <section className="hero">
        <div className="container-w">
          <div className="hero-grid">
            <div>
              <Eyebrow>Sports first &middot; Built for AI agents</Eyebrow>
              <h1>
                The moment engine
                <span className="script">for brands and their AI&nbsp;agents.</span>
              </h1>
              <p className="hero-sub">
                <BrandSpan /> watches every game, finds the customers who care,
                matches the right products, and has the campaign ready while
                the moment is still hot. You send it. One MCP connection plugs
                it into Claude or any AI agent.
              </p>
              <div className="hero-actions">
                <a href="#form" className="btn-primary">
                  <span>Get Early Access, Free</span>
                </a>
                <a href="#how" className="btn-ghost">
                  <span>See how it works</span>
                </a>
              </div>
              <div className="hero-note">
                {PRICING.trialDays} days free &middot; Done for you during
                early access
              </div>
            </div>

            <AgentConsole />
          </div>
        </div>
      </section>

      {/* ─── LEAGUES ─────────────────────────────────────────── */}
      <div className="league-strip">
        <div className="container-w league-strip-inner">
          <span className="league-strip-label">V1 coverage</span>
          <ul className="league-strip-list">
            {LEAGUES.map((l) => (
              <li key={l.id}>
                {l.name}
                {l.note ? <span className="league-strip-note">{l.note}</span> : null}
              </li>
            ))}
          </ul>
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

            <div className="moment-card" aria-label="Example: the email that goes out after a win">
              <div className="moment-card-final">
                <span>Final</span>Chargers 27, Chiefs 20
              </div>
              <div className="moment-card-meta">
                Ready 2 minutes later &middot; 2,310 customers in their territory
              </div>
              <div className="moment-card-email">
                <div className="moment-card-subject">Powder blue kind of Sunday.</div>
                <div className="moment-card-items">
                  {MOMENT_PICKS.map((p) => (
                    <div key={p.colorway} className="moment-card-item">
                      <span className="moment-card-photo" style={{ backgroundColor: `#${p.hex}` }} aria-hidden />
                      <b>{p.title}</b>
                      <span>{p.colorway}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="moment-card-foot">
                No logo. No license. Your catalog, in their colors.
              </div>
            </div>
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
            Four steps. <em>We set them up for you.</em>
          </h2>
          <p className="section-lead">
            During early access we set up your brand, map your fans and tag
            your catalog. Then your team works in Claude: it finds the moment,
            builds the campaign and drafts it in Klaviyo for your go-ahead.{" "}
            <Link href={helpPath("onboarding")} className="section-lead-link">
              See every step
            </Link>
          </p>
          <ol className="how-grid how-grid-4">
            {STEPS.map((s, idx) => (
              <li key={s.title} className="how-step">
                <div className="how-step-num">&mdash; 0{idx + 1}</div>
                <div className="how-step-title">{s.title}</div>
                <p className="how-step-body">{s.body}</p>
                <div className="how-step-visual">{s.visual}</div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ─── AFFINITY ────────────────────────────────────────── */}
      <section className="dark-block" id="affinity">
        <div className="container-w">
          <div className="block-num block-num-dark">
            <span className="eyebrow-dot" aria-hidden />
            Your affinity map
          </div>
          <h2 className="section-title section-title-stack">
            Day one, you learn{" "}
            <em>something new about your customers.</em>
          </h2>
          <p className="section-lead section-lead-dark">
            Drop in your exports and Walkoff shows which fan territories your
            customers lean toward, using widely recognized fan territory maps
            for every league. Then it matches your products to each team, down
            to the colorway.
          </p>
          <div className="affinity-grid">
            {AFFINITY_EXAMPLES.map((a) => (
              <div key={a.group} className="affinity-card">
                <div className="affinity-lift">{a.lift}</div>
                <div className="affinity-group">{a.group}</div>
                <div className="affinity-customers">
                  {a.customers} customers
                </div>
                <div className="affinity-match">
                  <span>Top match</span>
                  <Swatches hex={a.swatches} />
                  {a.match}
                </div>
              </div>
            ))}
          </div>
          <p className="affinity-foot">
            Example map. 2.4&times; means 2.4 times more of your customers live
            there than population alone would predict.
          </p>
        </div>
      </section>

      {/* ─── MOMENTS ─────────────────────────────────────────── */}
      <section className="block" id="moments">
        <div className="container-w">
          <div className="block-num">
            <span className="eyebrow-dot" aria-hidden />
            Moments
          </div>
          <h2 className="section-title section-title-stack">
            Sports first. <em>Then everything that moves your customers.</em>
          </h2>
          <div className="category-grid">
            {MOMENT_CATEGORIES.map((c) => (
              <div
                key={c.id}
                className={`category-card category-card-${c.status}`}
              >
                <div className="category-head">
                  <div className="category-name">{c.name}</div>
                  <span className={`category-badge category-badge-${c.status}`}>
                    {MOMENT_STATUS_LABEL[c.status]}
                  </span>
                </div>
                <p className="category-body">{c.description}</p>
                <div className="moment-tags">
                  {c.examples.map((ex) => (
                    <span key={ex} className="moment-tag">
                      {ex}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="trigger-library">
            <div className="trigger-library-head">
              <div className="trigger-library-title">
                The sports trigger library
              </div>
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
                />
              ))}
            </div>
          </div>
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
                For Claude and every AI agent
              </div>
              <h2 className="section-title">
                One connection. <em>Every agent.</em>
              </h2>
              <p className="section-lead section-lead-dark">
                Walkoff runs as an MCP server, the open standard Claude and
                other AI agents use to call tools. Connect it once and Claude
                can see what just happened for the teams your customers
                follow, build the campaign, and draft it in Klaviyo for your
                yes.
              </p>
              <div className="code-block">
                <span className="c">{`# Claude: ${CONNECTOR_STEPS}`}</span>
                {"\n"}
                <span className="s">{CONNECTOR_URL}</span>
                {"\n\n"}
                <span className="c">{"# Claude Code"}</span>
                {"\n"}
                <span className="k">claude</span> mcp add --transport http{" "}
                <span className="s">walkoff</span>
                {" \\\n  "}
                <span className="s">{CONNECTOR_URL}</span>
              </div>
              <ul className="mcp-notes">
                <li>
                  <span className="mcp-notes-badge">Early access</span>
                  Invited brands sign in with their work email. Ask us for an
                  invite.
                </li>
                <li>
                  Works next to the Klaviyo and Shopify connectors you already
                  use: Walkoff builds the campaign, your Klaviyo connector
                  drafts it, you hit send.
                </li>
                <li>
                  The engine watches every game around the clock, so the
                  moment is already in your queue when you open Claude.
                </li>
                <li>
                  Every tool, and what to ask it:{" "}
                  <Link href={helpPath("tools")}>Tools and asks</Link>.
                </li>
              </ul>
            </div>
            <div className="mcp-tools">
              {HOME_TOOLS.map((t) => (
                <div key={t.name} className="mcp-tool">
                  <div className="mcp-tool-name">
                    {t.name}
                    {"soon" in t && <span className="mcp-tool-soon">Coming</span>}
                  </div>
                  <p className="mcp-tool-body">{t.body}</p>
                </div>
              ))}
            </div>
          </div>
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
              <Image
                src="/postscript_logo.svg"
                alt="Postscript"
                width={189}
                height={59}
                unoptimized
                className="integration-logo integration-logo-postscript"
              />
              <span className="integration-badge integration-badge-progress">
                In Progress
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
                In Progress
              </span>
            </div>
            <div className="integration-item">
              <div className="integration-name">MCP &middot; Claude &amp; agents</div>
              <span className="integration-badge integration-badge-progress">
                Early Access
              </span>
            </div>
            <div className="integration-item">
              <div className="integration-name">Webhooks</div>
              <span className="integration-badge integration-badge-soon">
                Coming Soon
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
            Pick your leagues. Every trigger, every moment category and
            everything we build next comes with it.
          </p>
          <div className="pricing-layout">
            <PricingPicker />
            <div className="pricing-side">
              <div className="pricing-side-card pricing-side-dark">
                <div className="pricing-tier">&mdash; Agencies</div>
                <div className="pricing-side-h">Running several brands?</div>
                <p className="pricing-side-p">
                  One onboarding, one bill, every brand on its own affinity
                  map. Tell us how many brands you run and we&apos;ll price it.
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
                We onboard by hand during early access. Tell us about your
                brand and we&apos;ll build your affinity map, tag your catalog
                and set up your first triggers with you.
              </p>
              <ul className="form-perks">
                <li>
                  <span className="form-perks-check">✓</span>
                  Done for you, start to finish
                </li>
                <li>
                  <span className="form-perks-check">✓</span>
                  Your affinity map before your first moment
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
            Any brand whose customers have a team, a hometown or a season,
            and especially brands that will never have a sports license. When
            a team wins, Walkoff features your own products in its colors, so
            you show up for the moment without a logo. Licensed brands, local
            bars and restaurants, and agencies use it too. Leave team logos
            and trademarks out of your messages unless you&apos;re licensed:
            the colors do the talking.
          </FaqItem>
          <FaqItem num="02" question="What do I upload?">
            Your Shopify order or customer export, or a Klaviyo profile
            export, plus your product export. Your browser reads them and
            sends us only counts per postal area and your product details,
            including every colorway. No names, no emails, no street
            addresses. Our export guides take a few minutes.
          </FaqItem>
          <FaqItem num="03" question={<>Does <BrandSpan /> send the messages?</>}>
            Your email platform does, from your own account. Walkoff builds
            the campaign, Claude drafts it in Klaviyo with your connector, and
            you send it. Your deliverability, unsubscribes and suppression
            rules stay exactly as they are.
          </FaqItem>
          <FaqItem num="04" question="What's MCP, and do I need it?">
            MCP (Model Context Protocol) is the open standard AI agents like
            Claude use to call outside tools. You don&apos;t need it: during
            early access we can run everything for you. If your team works in
            Claude, add Walkoff as a connector at www.walkoff.io/mcp, next to
            Klaviyo and Shopify, and ask it for a campaign.
          </FaqItem>
          <FaqItem num="05" question="How fast do moments show up?">
            Within about a minute of the final whistle, the moment is in your
            queue in Claude, ready to build into a campaign. Nothing sends
            until you say so.
          </FaqItem>
          <FaqItem num="06" question="Which leagues are covered?">
            NFL, NBA, NHL, NCAA football and basketball, and the Premier
            League, with MLB from Opening Day 2027. Need a league that
            isn&apos;t listed? Ask. It&apos;s usually quick to add.
          </FaqItem>
          <FaqItem num="07" question="How do you prove it worked?">
            Today every moment you draft, send or skip is logged, so you can
            see what went out and when. Coming next: a small random slice of
            each audience won&apos;t get the message, so comparing the two
            groups shows what the moment actually added, and each send gets
            matched to your orders.
          </FaqItem>
          <FaqItem num="08" question="Is my data safe?">
            We work from counts, not customer lists, so there&apos;s no email
            address to leak. We ask for the narrowest API access that works,
            encrypt keys, and wall off each brand&apos;s data from every other
            brand&apos;s.
          </FaqItem>
          <FaqItem num="09" question="What does it cost?">
            ${PRICING.firstLeague} a month per brand, including one league.
            Each extra league is ${PRICING.extraLeague}, and every league
            together is ${PRICING.allLeagues}. Every trigger, category and
            feature we ship is included. {PRICING.trialDays} days free, no
            credit card.
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
            <a href="#form" className="btn-primary">
              <span>Claim Early Access, Free</span>
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
