"use client";

import { useEffect } from "react";

// Captures ?ref=CODE on any page: stores it in a 90-day cookie and records a
// click. The checkout route reads the cookie to apply the affiliate discount.
export function AffiliateTracker() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (!ref) return;

    // Set cookie (90 days)
    const exp = new Date(Date.now() + 90 * 86_400_000).toUTCString();
    document.cookie = `jobsai_ref=${encodeURIComponent(ref)}; path=/; expires=${exp}; SameSite=Lax`;

    // Record click once per ref per session
    const seen = sessionStorage.getItem("jobsai_ref_tracked");
    if (seen !== ref) {
      sessionStorage.setItem("jobsai_ref_tracked", ref);
      fetch(`/api/affiliates/track?ref=${encodeURIComponent(ref)}`, { method: "POST" }).catch(() => {});
    }
  }, []);

  return null;
}
