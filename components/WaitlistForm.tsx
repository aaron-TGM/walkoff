"use client";

import Link from "next/link";
import { useState } from "react";
import { visitAttribution } from "@/lib/analytics";
import { helpPath } from "@/lib/help/pages";
import { LEAGUES } from "@/lib/leagues";
import { PRICING } from "@/lib/pricing";
import { PLATFORMS, ROLES, type Attribution } from "@/lib/waitlist";

/** defaults fill in what Walkoff already knows (a pitch page knows the
 *  brand). source says where the request came from, over the visit's own
 *  campaign tags. */
export function WaitlistForm({ defaults, source }: { defaults?: { company?: string; website?: string }; source?: Attribution } = {}) {
  const [company, setCompany] = useState(defaults?.company ?? "");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(defaults?.website ?? "");
  const [role, setRole] = useState("");
  const [platform, setPlatform] = useState("");
  const [leagues, setLeagues] = useState<string[]>([]);
  const [teams, setTeams] = useState("");
  // Honeypot: real people never see or fill this field.
  const [fax, setFax] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  function toggleLeague(id: string) {
    setLeagues((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!company.trim() || !email.trim() || !role || !platform) {
      setError("Please fill in your brand, email, role and email platform.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: company.trim(),
          email: email.trim(),
          website: website.trim(),
          role,
          platform,
          leagues,
          teams: teams.trim(),
          fax,
          attribution: { ...visitAttribution(), ...source },
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Try again.");
        return;
      }
      setDone(true);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="form-success">
        <div className="form-success-script">You&apos;re in.</div>
        <div className="form-success-h">We&apos;ll be in touch within 24 hours.</div>
        <p className="form-success-p">
          Next up: we set up your brand. Then you connect Walkoff and Shopify
          in Claude, and your fan map is ready in minutes. No exports.{" "}
          <Link href={helpPath("shopify")}>How it works</Link>
        </p>
        <p className="form-success-p">
          While you wait, <Link href="/upload/demo">see a sample map</Link>{" "}
          (no file needed), or read{" "}
          <Link href={helpPath("onboarding")}>what setup looks like</Link>.
        </p>
      </div>
    );
  }

  return (
    <form className="waitlist-form" onSubmit={onSubmit} noValidate>
      <div className="form-grid-2-inner">
        <div className="form-row">
          <label className="form-label" htmlFor="f-company">
            Brand / company *
          </label>
          <input
            id="f-company"
            name="company"
            type="text"
            className="form-input"
            autoComplete="organization"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
        </div>
        <div className="form-row">
          <label className="form-label" htmlFor="f-email">
            Work email *
          </label>
          <input
            id="f-email"
            name="email"
            type="email"
            className="form-input"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
      </div>

      <div className="form-row">
        <label className="form-label" htmlFor="f-website">
          Website
        </label>
        <input
          id="f-website"
          name="website"
          type="text"
          inputMode="url"
          className="form-input"
          autoComplete="url"
          placeholder="yourbrand.com"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      <div className="form-grid-2-inner">
        <div className="form-row">
          <label className="form-label" htmlFor="f-role">
            I&apos;m a *
          </label>
          <select
            id="f-role"
            name="role"
            className="form-input"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="">Select</option>
            {ROLES.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <label className="form-label" htmlFor="f-platform">
            Email / SMS platform *
          </label>
          <select
            id="f-platform"
            name="platform"
            className="form-input"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
          >
            <option value="">Select</option>
            {PLATFORMS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-row">
        <div className="form-label" id="f-leagues-label">
          Leagues you care about
        </div>
        <div className="chip-row" role="group" aria-labelledby="f-leagues-label">
          {LEAGUES.map((l) => {
            const on = leagues.includes(l.id);
            return (
              <button
                key={l.id}
                type="button"
                className={`chip chip-sm${on ? " chip-on" : ""}`}
                aria-pressed={on}
                onClick={() => toggleLeague(l.id)}
              >
                {l.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="form-row">
        <label className="form-label" htmlFor="f-teams">
          Teams or markets you care about
        </label>
        <input
          id="f-teams"
          name="teams"
          type="text"
          className="form-input"
          placeholder="Eagles, Phillies, all of Texas, not sure yet"
          value={teams}
          onChange={(e) => setTeams(e.target.value)}
        />
      </div>

      <div className="form-hp" aria-hidden>
        <label htmlFor="f-fax">Fax</label>
        <input
          id="f-fax"
          name="fax"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={fax}
          onChange={(e) => setFax(e.target.value)}
        />
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      <button type="submit" className="form-submit" disabled={loading}>
        <span>{loading ? "Submitting…" : "Get early access →"}</span>
      </button>
      <p className="form-fine">
        No credit card &middot; {PRICING.trialDays} days free &middot; We reply
        within 24 hours
      </p>
    </form>
  );
}
