import { BrandSpan } from "@/components/BrandSpan";
import { Eyebrow } from "@/components/Eyebrow";
import { FaqItem } from "@/components/FaqItem";
import { HeroCard } from "@/components/HeroCard";
import { WaitlistForm } from "@/components/WaitlistForm";
import { TRIGGERS, TRIGGER_CATEGORIES } from "@/lib/triggers";

export function MarketingPage() {
  return (
    <>
      {/* ─── NAV ─────────────────────────────────────────────── */}
      <nav className="site-nav" aria-label="Primary">
        <div className="nav-inner">
          <a href="#" className="nav-mark">
            WALKOFF.
          </a>
          <div className="nav-links">
            <a href="#how">How it works</a>
            <a href="#triggers">Triggers</a>
            <a href="#pricing">Pricing</a>
            <a href="#form">Early Access</a>
          </div>
          <a href="#form" className="nav-cta">
            <span>Get Early Access</span>
          </a>
        </div>
      </nav>

      {/* ─── HERO ────────────────────────────────────────────── */}
      <section className="hero">
        <div className="container-w">
          <div className="hero-grid">
            <div>
              <Eyebrow>
                Beta &middot; MLB &middot; NHL &middot; NCAA Football &middot; NCAA Basketball
              </Eyebrow>
              <h1>
                Every sports moment
                <span className="script">is a marketing moment.</span>
              </h1>
              <p className="hero-sub">
                <BrandSpan /> connects your Klaviyo to the full sports calendar.
                Rivalry previews, in-game alerts, win triggers, season milestones —
                every moment your customer cares about, turned into a timely email.
              </p>
              <div className="hero-actions">
                <a href="#form" className="btn-primary">
                  <span>Get Early Access — Free</span>
                </a>
                <a href="#how" className="btn-ghost">
                  <span>See how it works</span>
                </a>
              </div>
              <div className="hero-note">
                First 20 brands &middot; Free 60 days &middot; We set everything up
              </div>
            </div>

            <HeroCard />
          </div>
        </div>
      </section>

      {/* ─── WHO ─────────────────────────────────────────────── */}
      <section className="block border-y border-rule bg-paper" id="who">
        <div className="container-w">
          <h2 className="section-title">
            If your customers care{" "}
            <em>when the team wins,</em> you have a trigger opportunity.
          </h2>
          <div className="who-grid">
            <div className="who-card who-card-dark">
              <div className="who-eyebrow">Primary ICP</div>
              <div className="who-card-h">Licensed DTC Brands</div>
              <p className="who-card-p">
                You have team-tagged SKUs, a Klaviyo account, and licensing fees
                to justify. <BrandSpan /> turns every game result into a revenue
                event.
              </p>
              <div className="who-card-ex">
                MLB &middot; NHL &middot; NFL &middot; NBA &middot; NCAA — official licensees with Klaviyo
              </div>
            </div>
            <div className="who-card who-card-light">
              <div className="who-eyebrow">Also a great fit</div>
              <div className="who-card-h">Local &amp; Adjacent Businesses</div>
              <p className="who-card-p">
                No license required. Any business in a sports city with an email
                list — restaurants, bars, dispensaries, local retail.
              </p>
              <div className="who-card-ex">
                Downtown LA restaurant &rarr; Dodgers win &rarr; &ldquo;$2 off tonight,
                11–close.&rdquo;
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── MOMENTS ─────────────────────────────────────────── */}
      <section className="block" id="moments">
        <div className="container-w">
          <div className="block-num">
            <span className="eyebrow-dot" aria-hidden />
            The full sports calendar
          </div>
          <h2 className="section-title">
            Not just when the game ends.{" "}
            <em>Every moment that moves your customer.</em>
          </h2>
          <div className="moments-grid">
            {/* Before */}
            <div className="moment-card">
              <div className="moment-icon text-red">
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 40 40"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <rect x="5" y="8" width="30" height="26" rx="2" />
                  <path d="M5 16 H35" />
                  <path d="M13 4 V12 M27 4 V12" />
                  <path d="M12 23 H14 M19 23 H21 M26 23 H28" />
                  <path d="M12 29 H14 M19 29 H21" />
                </svg>
              </div>
              <div className="moment-cat">Before</div>
              <div className="moment-title">Anticipation</div>
              <p className="moment-body">
                Rivalry in 48 hours. Playoff preview. Fire a pre-game campaign
                while fans are already talking.
              </p>
              <div className="moment-tags">
                <span className="moment-tag">rivalry_preview</span>
                <span className="moment-tag">big_game_alert</span>
              </div>
            </div>

            {/* During */}
            <div className="moment-card">
              <div className="moment-icon text-mustard">
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 40 40"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M23 4 L10 22 H19 L17 36 L30 17 H21 Z" />
                </svg>
              </div>
              <div className="moment-cat">During</div>
              <div className="moment-title">Tension</div>
              <p className="moment-body">
                Tied in the 8th. Final two minutes. Fans are on their
                phones — that&apos;s your window.
              </p>
              <div className="moment-tags">
                <span className="moment-tag">close_game</span>
                <span className="moment-tag">comeback_live</span>
              </div>
            </div>

            {/* After */}
            <div className="moment-card">
              <div className="moment-icon text-red">
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 40 40"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M20 32 C18 30 6 23 6 14 C6 9.5 9.5 6 14 6 C17 6 19.5 8 20 9 C20.5 8 23 6 26 6 C30.5 6 34 9.5 34 14 C34 23 22 30 20 32 Z" />
                </svg>
              </div>
              <div className="moment-cat">After</div>
              <div className="moment-title">The Result</div>
              <p className="moment-body">
                Walk-off win. Rivalry sweep. Heartbreaker loss. Each result = a
                different angle and a different offer.
              </p>
              <div className="moment-tags">
                <span className="moment-tag">walkoff_win</span>
                <span className="moment-tag">heartbreak_loss</span>
              </div>
            </div>

            {/* Season */}
            <div className="moment-card">
              <div className="moment-icon text-grass">
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 40 40"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M13 5 H27 V17 C27 23 23 26 20 26 C17 26 13 23 13 17 Z" />
                  <path d="M7 7 H13 C13 15 8.5 17 7 13 Z" />
                  <path d="M27 7 H33 C33 17 27.5 15 27 7 Z" />
                  <path d="M17 26 V31 M23 26 V31" />
                  <path d="M13 31 H27" />
                </svg>
              </div>
              <div className="moment-cat">Season</div>
              <div className="moment-title">Milestones</div>
              <p className="moment-body">
                Playoff clinch. Championship. Season opener. Moments your
                competitors are silent on.
              </p>
              <div className="moment-tags">
                <span className="moment-tag">playoff_clinch</span>
                <span className="moment-tag">title_won</span>
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
            Three steps. <em>Zero technical lift.</em>
          </h2>
          <div className="how-grid">
            <div>
              <div className="how-step-num">— 01</div>
              <div className="how-step-title">Connect Klaviyo</div>
              <p className="how-step-body">
                Share your API key (events-write only). We can&apos;t read your
                lists or send emails. Encrypted at rest.
              </p>
              <div className="how-step-visual">
                <span className="c">{"// Verified"}</span>
                <br />
                <span className="k">scope</span>:{" "}
                <span className="v">&quot;events:write ✓&quot;</span>
              </div>
            </div>
            <div>
              <div className="how-step-num">— 02</div>
              <div className="how-step-title">We build your setup</div>
              <p className="how-step-body">
                We create three segments targeting your buyers, cart abandoners,
                and browsers — plus a trigger flow, before your next game.
              </p>
              <div className="how-step-visual">
                <span className="k">seg_1</span>:{" "}
                <span className="v">&quot;Buyers 60d&quot;</span>
                <br />
                <span className="k">seg_2</span>:{" "}
                <span className="v">&quot;Cart Add 14d&quot;</span>
                <br />
                <span className="k">seg_3</span>:{" "}
                <span className="v">&quot;Browsers 30d&quot;</span>
              </div>
            </div>
            <div>
              <div className="how-step-num">— 03</div>
              <div className="how-step-title">
                Moment hits. <BrandSpan /> fires.
              </div>
              <p className="how-step-body">
                We watch the calendar. When your trigger moment occurs, a
                structured event hits your Klaviyo and your flow activates.
              </p>
              <div className="how-step-visual">
                <span className="k">event</span>:{" "}
                <span className="v">&quot;[Walkoff] Win&quot;</span>
                <br />
                <span className="k">team</span>:{" "}
                <span className="v">&quot;LAD&quot;</span>{" "}
                <span className="k">score</span>:{" "}
                <span className="v">&quot;6-5&quot;</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── TRIGGERS ────────────────────────────────────────── */}
      <section className="block" id="triggers">
        <div className="container-w">
          <div className="block-num">
            <span className="eyebrow-dot" aria-hidden />
            Trigger library
          </div>
          <h2 className="section-title">
            Every moment, <em>ready to fire.</em>
          </h2>
          <div className="trigger-section">
            {TRIGGER_CATEGORIES.map((cat) => {
              const items = TRIGGERS.filter((t) => t.category === cat.id);
              return (
                <div key={cat.id} className="trigger-cat">
                  <div className="trigger-cat-label">
                    — <span>{cat.label}</span>
                  </div>
                  <div className="trigger-grid-3">
                    {items.map((t) => (
                      <div
                        key={t.id}
                        className="border border-rule bg-paper p-[1.1rem]"
                      >
                        <div className="mb-1 font-display text-[0.9rem] font-bold uppercase tracking-[-0.005em]">
                          {t.name}
                        </div>
                        <div className="mb-2.5 font-mono text-[0.58rem] tracking-[0.05em] text-red">
                          {t.id}
                        </div>
                        <p className="text-[0.8rem] leading-[1.45] text-inkMuted">
                          {t.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── CASE STUDY ──────────────────────────────────────── */}
      {/* ─── INTEGRATIONS ────────────────────────────────────── */}
      <div className="integrations-bar">
        <div className="container-w">
          <div className="integrations-label">
            Integrates with your existing stack
          </div>
          <div className="integrations-row">
            <div className="integration-item">
              <div className="integration-name">Klaviyo</div>
              <span className="integration-badge integration-badge-live">
                Live
              </span>
            </div>
            <div className="integration-item">
              <div className="integration-name">Postscript</div>
              <span className="integration-badge integration-badge-soon">
                Coming Soon
              </span>
            </div>
            <div className="integration-item">
              <div className="integration-name">Attentive</div>
              <span className="integration-badge integration-badge-soon">
                Coming Soon
              </span>
            </div>
            <div className="integration-item">
              <div className="integration-name">Shopify</div>
              <span className="integration-badge integration-badge-soon">
                Coming Soon
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── PRICING ─────────────────────────────────────────── */}
      <section className="block border-y border-rule bg-paper" id="pricing">
        <div className="container-w">
          <div className="block-num">
            <span className="eyebrow-dot" aria-hidden />
            Pricing
          </div>
          <h2 className="section-title">
            One flat rate per league.{" "}
            <em>Every game. Every trigger.</em>
          </h2>
          <p className="section-lead">
            First 20 brands get 60 days free. No credit card required.
          </p>
          <div className="pricing-grid">
            {/* Starter */}
            <div className="pricing-card">
              <div className="pricing-tier">— Starter</div>
              <div className="pricing-name">Single Team</div>
              <div className="pricing-price">
                $149<span className="pricing-freq">/mo</span>
              </div>
              <div className="pricing-billed">$1,430/yr — save 20%</div>
              <ul className="pricing-features">
                <li>One team, one league</li>
                <li>All triggers included</li>
                <li>Klaviyo integration</li>
                <li>Segments + flow built</li>
                <li className="dim">Multi-league</li>
                <li className="dim">SMS integrations</li>
              </ul>
              <a href="#form" className="btn-ghost block text-center">
                <span>Get Early Access</span>
              </a>
            </div>

            {/* Growth (featured) */}
            <div className="pricing-card pricing-card-feat">
              <div className="pricing-tier">— Growth</div>
              <div className="pricing-name">Single League</div>
              <div className="pricing-price">
                $299<span className="pricing-freq">/mo</span>
              </div>
              <div className="pricing-billed">$2,870/yr — save 20%</div>
              <ul className="pricing-features">
                <li>All teams, one league</li>
                <li>All triggers included</li>
                <li>Klaviyo integration</li>
                <li>Segments + flow built</li>
                <li>Priority support</li>
                <li className="dim">SMS integrations</li>
              </ul>
              <a href="#form" className="btn-primary block text-center">
                <span>Get Early Access</span>
              </a>
            </div>

            {/* Pro */}
            <div className="pricing-card">
              <div className="pricing-tier">— Pro</div>
              <div className="pricing-name">Multi-League</div>
              <div className="pricing-price">
                $499<span className="pricing-freq">/mo</span>
              </div>
              <div className="pricing-billed">$4,790/yr — save 20%</div>
              <ul className="pricing-features">
                <li>All teams, all leagues</li>
                <li>All triggers included</li>
                <li>Klaviyo + SMS (when live)</li>
                <li>Flows built per league</li>
                <li>Onboarding session</li>
                <li>Custom trigger config</li>
              </ul>
              <a href="#form" className="btn-ghost block text-center">
                <span>Get Early Access</span>
              </a>
            </div>
          </div>
          <div className="pricing-note">
            60-day free trial &middot; No credit card &middot; Cancel anytime
          </div>
        </div>
      </section>

      {/* ─── FORM ────────────────────────────────────────────── */}
      <section className="block" id="form">
        <div className="container-w">
          <div className="form-grid">
            <div>
              <div className="block-num">
                <span className="eyebrow-dot" aria-hidden />
                Early Access
              </div>
              <h2 className="form-left-title">
                First 20. Free for <em>60 days.</em>
              </h2>
              <p className="form-left-body">
                We onboard manually. Tell us your team and we do the rest —
                segments, flow, and the first 5 triggers fired by us. You collect
                the data.
              </p>
              <ul className="form-perks">
                <li>
                  <span className="form-perks-check">✓</span>
                  Klaviyo segments + trigger flow built for you
                </li>
                <li>
                  <span className="form-perks-check">✓</span>
                  First 5 triggers fired manually — we watch the games
                </li>
                <li>
                  <span className="form-perks-check">✓</span>
                  Works with or without a sports license
                </li>
              </ul>
              <div className="form-counter">
                <div>
                  <div className="form-counter-num">14</div>
                </div>
                <div className="form-counter-label">
                  Spots
                  <br />
                  Remaining
                </div>
              </div>
            </div>

            <div>
              <WaitlistForm />
            </div>
          </div>
        </div>
      </section>

      {/* ─── FAQ ─────────────────────────────────────────────── */}
      <section className="block border-y border-rule bg-paper" id="faq">
        <div className="container-narrow">
          <div className="block-num">
            <span className="eyebrow-dot" aria-hidden />
            FAQ
          </div>
          <h2 className="section-title">
            Questions <em>people actually ask.</em>
          </h2>

          <FaqItem num="01" question="Do I need a sports license?" defaultOpen>
            No. Licensed DTC brands are our primary ICP, but any business with
            customers in a sports city qualifies — restaurants, bars, dispensaries,
            local retail. Anyone with an email list and customers who follow the
            home team.
          </FaqItem>
          <FaqItem num="02" question={<>Does <BrandSpan /> send the emails?</>}>
            Never. <BrandSpan /> fires events into Klaviyo as custom metrics.
            Klaviyo handles all sending, suppression, and deliverability. We
            can&apos;t read your lists, send campaigns, or access subscriber data.
          </FaqItem>
          <FaqItem num="03" question="How fast does a trigger fire?">
            During the beta we fire manually — typically 8–15 minutes after the
            moment. The full platform fires automatically within 2–5 minutes via
            real-time sports data.
          </FaqItem>
          <FaqItem num="04" question="What happens after 60 days?">
            You&apos;ll have real attribution data. We talk through what worked and
            whether the paid tier makes sense. No auto-renewal. Plans start at
            $149/month.
          </FaqItem>
          <FaqItem num="05" question="Is my Klaviyo key safe?">
            Yes. Keys are encrypted at rest and we use events-write scope only.{" "}
            <BrandSpan /> can push custom metric events but cannot read lists,
            send campaigns, or access subscriber data.
          </FaqItem>
          <FaqItem num="06" question="Which leagues do you support?">
            Currently MLB, NHL, NCAA Football, and NCAA Basketball. NFL and NBA
            are on the roadmap for fall 2026. If you have a license for a league
            not listed, reach out — we&apos;ll see what we can do.
          </FaqItem>
        </div>
      </section>

      {/* ─── FINAL CTA ───────────────────────────────────────── */}
      <section className="final-cta">
        <div className="container-narrow">
          <div className="final-cta-script">WALKOFF.</div>
          <h2 className="final-cta-h">Stop missing the moment.</h2>
          <div className="final-cta-actions">
            <a href="#form" className="btn-primary">
              <span>Claim Early Access — Free</span>
            </a>
            <a href="mailto:hello@walkoff.io" className="btn-ghost">
              <span>Ask a question</span>
            </a>
          </div>
          <p className="final-cta-foot">
            14 spots remaining &middot; No credit card &middot; 60 days free &middot; We do
            the setup
          </p>
        </div>
      </section>

      {/* ─── FOOTER ──────────────────────────────────────────── */}
      <footer className="site-footer">
        <div className="container-w">
          <div className="footer-grid">
            <div>
              <div className="footer-mark">WALKOFF.</div>
              <p className="footer-tagline">
                The sports moment marketing layer for licensed DTC brands.
              </p>
            </div>
            <div className="footer-col">
              <div className="footer-col-title">Product</div>
              <ul>
                <li>
                  <a href="#how">How it works</a>
                </li>
                <li>
                  <a href="#triggers">Triggers</a>
                </li>
                <li>
                  <a href="#pricing">Pricing</a>
                </li>
                <li>
                  <a href="#form">Early Access</a>
                </li>
                <li>
                  <a href="#faq">FAQ</a>
                </li>
              </ul>
            </div>
            <div className="footer-col">
              <div className="footer-col-title">Company</div>
              <ul>
                <li>
                  <a href="#">Security</a>
                </li>
                <li>
                  <a href="#">Privacy</a>
                </li>
                <li>
                  <a href="#">Terms</a>
                </li>
                <li>
                  <a href="mailto:hello@walkoff.io">Contact</a>
                </li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© 2026 <BrandSpan /> · A Tuff Ghost Media product</span>
            <span>San Clemente, California</span>
            <span>walkoff.io</span>
          </div>
        </div>
      </footer>
    </>
  );
}
