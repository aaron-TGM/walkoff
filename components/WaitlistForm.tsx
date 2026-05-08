"use client";

import { useState } from "react";

const LEAGUES = [
  "MLB",
  "NHL",
  "NFL",
  "NBA",
  "NCAA Football",
  "NCAA Basketball",
  "Local / No license",
] as const;

export function WaitlistForm() {
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [league, setLeague] = useState("");
  const [team, setTeam] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!company.trim() || !email.trim() || !league.trim() || !team.trim()) {
      setError("Please fill in all fields.");
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
          league: league.trim(),
          team: team.trim(),
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
          We&apos;re setting up your segments and flow. Next time your team&apos;s moment
          hits, it fires in Klaviyo. Check your email for next steps.
        </p>
      </div>
    );
  }

  return (
    <form className="waitlist-form" onSubmit={onSubmit} noValidate>
      <div className="form-row">
        <label className="form-label" htmlFor="f-company">
          Company / Brand
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
          Your email
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
      <div className="form-grid-2-inner">
        <div className="form-row">
          <label className="form-label" htmlFor="f-league">
            League
          </label>
          <select
            id="f-league"
            name="league"
            className="form-input"
            value={league}
            onChange={(e) => setLeague(e.target.value)}
          >
            <option value="">Select</option>
            {LEAGUES.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <label className="form-label" htmlFor="f-team">
            Your team
          </label>
          <input
            id="f-team"
            name="team"
            type="text"
            className="form-input"
            value={team}
            onChange={(e) => setTeam(e.target.value)}
          />
        </div>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      <button type="submit" className="form-submit" disabled={loading}>
        <span>{loading ? "Submitting…" : "Claim Early Access →"}</span>
      </button>
      <p className="form-fine">
        No credit card &middot; We&apos;ll reach out to get your Klaviyo connected
      </p>
    </form>
  );
}
