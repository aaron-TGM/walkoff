// The homepage's example campaigns, drawn like the share image
// (app/opengraph-image.png) from what build_campaign returns for the demo
// brand (lib/help/samples.ts). Server components: the page is static, so
// they run at build time and none of the data behind them reaches the
// browser.
import { SAMPLE_CHAMPION, SAMPLE_TEAM, sampleCampaign, sampleHometownCampaign } from "@/lib/help/samples";
import type { CampaignProduct } from "@/lib/mcp/campaign";

/** Only plain hex reaches a style attribute. */
const color = (hex: string | undefined) => (hex && /^[0-9a-f]{6}$/i.test(hex) ? `#${hex}` : undefined);

/** The email as an inbox shows it: the subject, then the email itself. */
function MiniEmail({ subject, headline, products, stripe, cta }: { subject: string; headline: string; products: CampaignProduct[]; stripe: string[]; cta: string }) {
  return (
    <div className="moment-card-email">
      <div className="mini-email-subject">
        <span>Subject</span>
        {subject}
      </div>
      <div className="mini-email">
        <div className="mini-email-stripe" aria-hidden>
          {stripe.map((h) => (
            <i key={h} style={{ backgroundColor: color(h) }} />
          ))}
        </div>
        <div className="mini-email-brand">Your brand</div>
        <div className="mini-email-h">{headline}</div>
        <div className="moment-card-items">
          {products.map((p) => (
            <div key={`${p.title}:${p.colorway}`} className="moment-card-item">
              <span className="moment-card-photo" style={{ backgroundColor: color(p.hex[0]) }} aria-hidden />
              <b>{p.title}</b>
              <span>{p.colorway}</span>
            </div>
          ))}
        </div>
        <div className="mini-email-cta">{cta}</div>
      </div>
    </div>
  );
}

/** A Chargers walk-off, the campaign drafted and waiting. */
export function HeroCampaign() {
  const c = sampleCampaign();
  const [circle] = c.audience.circles;
  return (
    <figure className="moment-card moment-card-hero" aria-label="Example: the campaign Walkoff builds when the Chargers win">
      <div className="moment-card-final">
        <span>Final</span>Chargers 27, Chiefs 20
      </div>
      <div className="moment-card-meta">
        Example &middot; {SAMPLE_TEAM.team.nickname} territory &middot; within {circle.radius_miles} miles of{" "}
        {circle.postal_code}
      </div>
      <MiniEmail subject={c.subject_lines[0]} headline={c.headline} products={c.products} stripe={SAMPLE_TEAM.team.colors} cta={c.cta.label} />
      <figcaption className="moment-card-foot moment-card-foot-ok">
        Drafted in Klaviyo &middot; <span className="whitespace-nowrap">waiting for your go-ahead</span>
      </figcaption>
    </figure>
  );
}

/** A hometown title in San Clemente: one circle, and the town, never the athlete. */
export async function HometownExample() {
  const c = await sampleHometownCampaign();
  const [circle] = c.audience.circles;
  return (
    <figure className="moment-card" aria-label={`Example: a hometown campaign for ${c.audience.town}`}>
      <div className="moment-card-final">
        <span>Hometown title</span>
        {c.audience.town}
      </div>
      <div className="moment-card-meta">
        Example &middot; within {circle.radius_miles} miles of {circle.postal_code}
      </div>
      <MiniEmail subject={c.subject_lines[0]} headline={c.headline} products={c.products} stripe={SAMPLE_CHAMPION.team.colors} cta={c.cta.label} />
      <figcaption className="moment-card-foot">Celebrates the town. Never names the athlete.</figcaption>
    </figure>
  );
}
