"use client";

import { Analytics } from "@vercel/analytics/next";
import { useEffect } from "react";
import { redact, rememberCta, rememberVisit } from "@/lib/analytics";

/** Page views, counted without cookies and with private links taken out,
 *  and, for early access requests, where the visit came from. Early access
 *  buttons name themselves with data-cta. */
export function SiteAnalytics() {
  useEffect(() => {
    rememberVisit(window.location.href, document.referrer);
    const onClick = (e: MouseEvent) => {
      const cta = (e.target as Element | null)?.closest?.("[data-cta]")?.getAttribute("data-cta");
      if (cta) rememberCta(cta);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return <Analytics beforeSend={redact} />;
}
