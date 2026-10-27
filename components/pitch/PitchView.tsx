// The page a prospect opens from Walkoff's email: the campaign Walkoff
// built from their own catalog for their home team, how it would have
// gone out, and early access. Everything comes from the pitch as saved.
import { Swatches } from "@/components/upload/AffinityReportView";
import { WaitlistForm } from "@/components/WaitlistForm";
import { teamByKey } from "@/lib/mcp/teams";
import { SEND_HOURS } from "@/lib/mcp/timing";
import { cap, possessive, teamPhrase, territoryName, winVerb, wonPhrase, type PitchPage } from "@/lib/outreach/pitch";
import { PRICING } from "@/lib/pricing";
import type { Attribution } from "@/lib/waitlist";

const hour = (h: number) => `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`;

const STEPS = [
  {
    title: "The moment",
    body: "Walkoff watches every game in its leagues. A moment lands in your queue in Claude about a minute after the final whistle.",
  },
  {
    title: "The campaign",
    body: "Claude builds it from your catalog: your products in the team's colors, the audience in its territory, and when to send.",
  },
  {
    title: "Your OK",
    body: "You review it, and Claude drafts it in your Klaviyo. Nothing sends until you say so.",
  },
];

export function PitchView({ page, source, demo = false }: { page: PitchPage; source?: Attribution; demo?: boolean }) {
  const t = teamByKey(page.team.key);
  const who = t ? teamPhrase(t) : page.team.name;
  const territory = t ? territoryName(t) : `${page.team.name} territory`;
  const happened = page.moment.occurred_at ? new Date(page.moment.occurred_at) : null;
  const day = happened
    ? new Intl.DateTimeFormat("en-US", { timeZone: page.team.tz, weekday: "long", month: "short", day: "numeric" }).format(happened)
    : null;
  const brand = page.prospect.name;

  return (
    <div className="container-w">
      <div className="block-num">
        <span className="eyebrow-dot" aria-hidden />
        {demo ? "Sample campaign" : `Built for ${brand}`}
      </div>
      <h1 className="upload-h1">
        {day ? `${cap(who)} ${wonPhrase(page.moment.type)} ${day}.` : `When ${who} ${t ? winVerb(t) : "win"},`}
        <em>Here&apos;s your email.</em>
      </h1>
      <p className="upload-lead">
        {demo
          ? `Walkoff built this from ${possessive(brand)} catalog: its products in their colors, for customers in ${territory}.`
          : `Walkoff built this from your catalog: your products in their colors, for customers in ${territory}.`}{" "}
        No logo, no license. {day ? "It's a sample: nothing was sent." : "It's a sample for their next win: nothing was sent."}
      </p>

      <div className="pitch-grid">
        <div className="help-email-wrap">
          <iframe className="help-email" title={`The email for ${brand}`} srcDoc={page.html} sandbox="" referrerPolicy="no-referrer" />
        </div>
        <dl className="help-kv">
          <dt>Subject</dt>
          <dd>{page.subject}</dd>
          <dt>Preview text</dt>
          <dd>{page.preview_text}</dd>
          <dt>Products</dt>
          <dd>
            {page.products.map((p, i) => (
              <span key={`${p.title}-${p.colorway}`}>
                {i ? ", " : ""}
                {p.title}
                {p.colorway ? ` in ${p.colorway}` : ""}
                <Swatches hex={p.hex} />
              </span>
            ))}
          </dd>
          <dt>Audience</dt>
          <dd>
            Customers in {territory}, within{" "}
            {page.audience.circles.map((c) => `${c.radius_miles} miles of ${c.postal_code}`).join(" or ")}.
          </dd>
          <dt>Sends</dt>
          <dd>
            {day
              ? `${page.send.send_at_local}. ${page.send.why}`
              : `Right after a win, between ${hour(SEND_HOURS.earliest)} and ${hour(SEND_HOURS.latest)} where the fans live. A late finish goes out at ${hour(SEND_HOURS.earliest)} the next morning.`}
          </dd>
        </dl>
      </div>

      <div className="pitch-steps">
        {STEPS.map((s, i) => (
          <section key={s.title} className="upload-step">
            <div className="upload-step-num">Step {i + 1}</div>
            <h2 className="upload-step-title">{s.title}</h2>
            <p className="upload-step-body">{s.body}</p>
          </section>
        ))}
      </div>

      <div className="form-grid" id="form">
        <div>
          <h2 className="form-left-title">
            Try it on the next win. <em>{PRICING.trialDays} days free.</em>
          </h2>
          <p className="form-left-body">
            Setup happens in Claude with your Shopify and Klaviyo connectors, and your fan map is ready
            in minutes. It shows where your customers cluster by team, beyond your hometown.
            {demo ? null : " Prefer email? Just reply to mine."}
          </p>
        </div>
        <WaitlistForm defaults={demo ? undefined : { company: brand, website: page.prospect.domain }} source={source} />
      </div>

      <p className="pitch-fine">
        A sample built from the products on {page.prospect.domain}. Walkoff hasn&apos;t seen your customers, your
        orders or your Klaviyo account.
      </p>
    </div>
  );
}
