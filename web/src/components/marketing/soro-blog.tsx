"use client";

import { useEffect } from "react";

// Soro blog embed (app.trysoro.com). Renders the target div and loads the
// deferred embed script once on mount; Soro injects the blog into #soro-blog and
// handles its own article routing. React never renders children into the div, so
// Soro's injected DOM doesn't conflict with hydration.
const SORO_SRC = "https://app.trysoro.com/api/embed/5ddea503-a01c-4ad8-8ef2-cb4527695449";

export function SoroBlog() {
  useEffect(() => {
    // Avoid double-injecting on client navigation.
    if (document.querySelector(`script[src="${SORO_SRC}"]`)) return;
    const s = document.createElement("script");
    s.src = SORO_SRC;
    s.defer = true;
    document.body.appendChild(s);
  }, []);

  return <div id="soro-blog" className="mx-auto min-h-[40vh] max-w-5xl px-6 py-12" />;
}
