"use client";

import { useEffect, useState } from "react";

// One-day fair promo banner: shows only on SHOW_ON (America/New_York), then
// disappears on its own with no deploy. The NEWCOMER26 code itself keeps
// working until its Stripe expiry (end of August); only the banner is one-day.
// Client-gated via effect so the statically generated marketing pages never
// bake a stale banner into cached HTML.
const SHOW_ON = "2026-07-22";

export function PromoBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const todayNY = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
    setShow(todayNY === SHOW_ON);
  }, []);

  if (!show) return null;

  return (
    <div className="bg-emerald-600 px-4 py-2.5 text-center text-sm font-semibold text-white">
      🎉 Today only: 50% off with code{" "}
      <span className="mx-1 rounded bg-white/20 px-2 py-0.5 font-mono tracking-widest">NEWCOMER26</span>{" "}
      <span className="font-normal text-emerald-50">Enter it at checkout when you start your trial.</span>
    </div>
  );
}
