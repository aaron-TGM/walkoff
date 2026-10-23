// Examples made by the campaign, audience and timing code itself, at build
// time (lib/help/samples.ts).
import { Swatches } from "@/components/upload/AffinityReportView";
import type { TeamAudience } from "@/lib/mcp/audience";
import { sampleCampaign, sampleEmailHtml, timingExamples } from "@/lib/help/samples";

const fmt = (n: number) => n.toLocaleString("en-US");
const pct = (n: number) => `${Math.round(n * 100)}%`;

/** What build_campaign returned for a sample, and the email itself. */
export function SampleCampaign() {
  const c = sampleCampaign();
  return (
    <>
      <dl className="help-kv">
        <dt>Subject lines</dt>
        <dd>
          <ol>
            {c.subject_lines.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </dd>
        <dt>Preview text</dt>
        <dd>{c.preview_text}</dd>
        <dt>Products</dt>
        <dd>
          {c.products.map((p, i) => (
            <span key={p.title}>
              {i ? ", " : ""}
              {p.title} in {p.colorway}
              <Swatches hex={p.hex} />
            </span>
          ))}
        </dd>
        <dt>Audience</dt>
        <dd>
          {c.audience.segment_name}: {c.audience.circles.map((x) => `within ${x.radius_miles} miles of ${x.postal_code}`).join(", or ")}
        </dd>
        <dt>Send</dt>
        <dd>
          {c.send.send_at_local}. {c.send.why}
        </dd>
        <dt>Warnings</dt>
        <dd>{c.warnings.join(" ")}</dd>
      </dl>
      <div className="help-email-wrap">
        <iframe className="help-email" title="The sample email" srcDoc={sampleEmailHtml()} sandbox="" loading="lazy" />
      </div>
      <p className="help-caption">
        The finished email, as build_campaign returns it for Klaviyo. Your store name and address
        and the unsubscribe link fill in when Klaviyo sends it.
      </p>
    </>
  );
}

/** A team's segment, as get_territory and build_campaign describe it. */
export function SegmentSummary({ audience }: { audience: TeamAudience }) {
  return (
    <dl className="help-kv">
      <dt>Segment name</dt>
      <dd>{audience.segment_name}</dd>
      <dt>Circles</dt>
      <dd>
        {audience.circles
          .map((x) => `Within ${x.radius_miles} miles of ${x.postal_code}${x.center_area === `around ${x.postal_code}` ? "" : ` (${x.center_area})`}`)
          .join("; or ")}
      </dd>
      <dt>Covers</dt>
      <dd>
        {pct(audience.coverage)} of the team&apos;s core fans. {pct(audience.precision)} of the people inside follow the team.
      </dd>
      {audience.customers ? (
        <>
          <dt>Your customers</dt>
          <dd>
            {fmt(audience.customers.in_circles)} of the {fmt(audience.customers.uploaded)} customers uploaded live inside.
          </dd>
        </>
      ) : null}
      {audience.outward_codes ? (
        <>
          <dt>Outward codes</dt>
          <dd>
            {audience.outward_codes.length} districts: {audience.outward_codes.slice(0, 8).join(", ")} and more.
          </dd>
        </>
      ) : null}
    </dl>
  );
}

export function SegmentSteps({ audience }: { audience: TeamAudience }) {
  return (
    <ol>
      {audience.klaviyo_segment_steps.map((s) => (
        <li key={s}>{s}</li>
      ))}
    </ol>
  );
}

export function TimingTable() {
  return (
    <div className="help-table-wrap">
      <table className="help-table help-table-stack">
        <thead>
          <tr>
            <th>What happened</th>
            <th>You ask</th>
            <th>Walkoff says send</th>
            <th>Why</th>
          </tr>
        </thead>
        <tbody>
          {timingExamples().map((t) => (
            <tr key={`${t.happened}:${t.asked}`}>
              <td>{t.happened}</td>
              <td data-label="You ask">{t.asked}</td>
              <td data-label="Walkoff says send">{t.send}</td>
              <td>{t.why}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RuleList({ rules }: { rules: string[] }) {
  return (
    <ul>
      {rules.map((r) => (
        <li key={r}>{r}</li>
      ))}
    </ul>
  );
}
