"use client";

import { useEffect } from "react";

// First-touch attribution: on the visitor's first landing (with UTMs or an
// external referrer), stores the trail in localStorage. The lead form sends it
// along so the agency sees which campaign produced each contact. First touch
// wins — later visits never overwrite it. Deliberately client-side: keeps the
// auth middleware untouched and survives navigation across public pages.

export const ATTRIBUTION_KEY = "jobsai_attribution";

export function AttributionCapture() {
  useEffect(() => {
    try {
      if (localStorage.getItem(ATTRIBUTION_KEY)) return;
      const params = new URLSearchParams(window.location.search);
      const utm: Record<string, string> = {};
      for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) {
        const v = params.get(k);
        if (v) utm[k] = v.slice(0, 120);
      }
      const referrer = document.referrer && !document.referrer.includes(window.location.hostname)
        ? document.referrer.slice(0, 200)
        : "";
      if (!Object.keys(utm).length && !referrer) return; // direct visit — nothing to attribute
      localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify({
        ...utm,
        ...(referrer ? { referrer } : {}),
        landing_page: window.location.pathname,
        first_seen: new Date().toISOString(),
      }));
    } catch {
      // storage unavailable (private mode etc.) — attribution is best-effort
    }
  }, []);
  return null;
}
