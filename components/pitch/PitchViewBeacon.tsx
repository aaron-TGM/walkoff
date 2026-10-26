"use client";

import { useEffect } from "react";

/** Counts this open of the pitch page. It runs only in a browser, so link
 *  checkers that just fetch the page don't count, and ?preview (the link
 *  the operator checks) doesn't either. */
export function PitchViewBeacon({ token }: { token: string }) {
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("preview")) return;
    fetch(`/api/p/${encodeURIComponent(token)}/view`, { method: "POST", keepalive: true }).catch(() => {});
  }, [token]);
  return null;
}
