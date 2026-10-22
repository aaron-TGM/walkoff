import type { Metadata } from "next";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Eyebrow } from "@/components/Eyebrow";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import { INCIDENTS } from "@/lib/incidents";
import { LEAGUES } from "@/lib/leagues";
import {
  STATE_LABEL,
  overallState,
  runStatusChecks,
  type CheckResult,
} from "@/lib/status";

// Re-run every check at most once a minute.
export const revalidate = 60;

export const metadata: Metadata = {
  title: "Status · Walkoff",
  description:
    "Live status of Walkoff's league data, platform and integrations, checked every minute.",
};

const OVERALL_COPY = {
  operational: "All checked systems operational",
  degraded: "Some systems are running slow",
  down: "Some systems are down",
  not_configured: "All checked systems operational",
} as const;

const COMING_ONLINE = [
  {
    name: "Walkoff MCP server",
    label: "Early access",
    detail: "Founding brands first, at mcp.walkoff.io",
  },
  {
    name: "Automated moment engine",
    label: "Early access",
    detail: "Moments are confirmed by hand while it ramps up",
  },
  { name: "Postscript", label: "In progress", detail: "SMS sends from moments" },
  { name: "Attentive", label: "In progress", detail: "SMS sends from moments" },
  { name: "Webhooks", label: "Coming soon", detail: "Moments delivered to any URL" },
];

const TARGETS = [
  { value: "60s", label: "Every check on this page re-runs at most once a minute" },
  { value: "15 min", label: "Early access: moments confirmed and sent by hand" },
  { value: "< 3 min", label: "Automated target: trigger fired after the final whistle" },
  { value: String(LEAGUES.length), label: "Leagues monitored live on this page" },
];

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function CheckGroup({ title, checks }: { title: string; checks: CheckResult[] }) {
  const up = checks.filter((c) => c.state === "operational").length;
  return (
    <section className="status-group">
      <div className="status-group-head">
        <h2 className="status-group-title">{title}</h2>
        <span className="status-group-count">
          {up}/{checks.length} operational
        </span>
      </div>
      <ul className="status-rows">
        {checks.map((c) => (
          <li key={c.id} className="status-row">
            <span className={`status-light status-light-${c.state}`} aria-hidden />
            <div className="status-row-main">
              <div className="status-row-name">{c.name}</div>
              <div className="status-row-detail">{c.detail}</div>
            </div>
            <div className="status-row-latency">
              {c.latencyMs !== undefined ? `${c.latencyMs} ms` : "—"}
            </div>
            <span className={`status-pill status-pill-${c.state}`}>
              {STATE_LABEL[c.state]}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function StatusPage() {
  const report = await runStatusChecks();
  const overall = overallState(report);

  return (
    <>
      <SiteNav />
      <AutoRefresh seconds={60} />
      <main className="status-page">
        <div className="container-w">
          <Eyebrow dot={overall === "operational" ? "green" : "red"}>
            System status
          </Eyebrow>
          <h1 className="status-h1">Walkoff status</h1>

          <div className={`status-banner status-banner-${overall}`}>
            <span className={`status-light status-light-${overall}`} aria-hidden />
            <span className="status-banner-text">{OVERALL_COPY[overall]}</span>
            <span className="status-banner-time">
              Checked {formatTime(report.checkedAt)} UTC
            </span>
          </div>

          <div className="status-targets">
            {TARGETS.map((t) => (
              <div key={t.label} className="status-target">
                <div className="status-target-value">{t.value}</div>
                <div className="status-target-label">{t.label}</div>
              </div>
            ))}
          </div>

          {report.engine ? <CheckGroup title="Moment engine" checks={report.engine} /> : null}
          <CheckGroup title="League data" checks={report.leagues} />
          <CheckGroup title="Platform" checks={report.platform} />
          <CheckGroup title="Integrations" checks={report.integrations} />

          <section className="status-group">
            <div className="status-group-head">
              <h2 className="status-group-title">Coming online</h2>
            </div>
            <ul className="status-rows">
              {COMING_ONLINE.filter(
                (c) => !(report.engine && c.name === "Automated moment engine"),
              ).map((c) => (
                <li key={c.name} className="status-row">
                  <span className="status-light status-light-soon" aria-hidden />
                  <div className="status-row-main">
                    <div className="status-row-name">{c.name}</div>
                    <div className="status-row-detail">{c.detail}</div>
                  </div>
                  <div className="status-row-latency">—</div>
                  <span className="status-pill status-pill-soon">{c.label}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="status-group">
            <div className="status-group-head">
              <h2 className="status-group-title">Incident history</h2>
            </div>
            {INCIDENTS.length === 0 ? (
              <p className="status-empty">
                No incidents recorded. Anything that affects moments or sends
                gets posted here as it happens.
              </p>
            ) : (
              <ul className="status-incidents">
                {INCIDENTS.map((i) => (
                  <li key={i.date + i.title} className="status-incident">
                    <div className="status-incident-meta">
                      {i.date} &middot; {i.status}
                    </div>
                    <div className="status-incident-title">{i.title}</div>
                    <p className="status-incident-body">{i.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="status-foot">
            This page refreshes itself every minute. Questions about an outage?{" "}
            <a href="mailto:hello@walkoff.io">hello@walkoff.io</a>
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
