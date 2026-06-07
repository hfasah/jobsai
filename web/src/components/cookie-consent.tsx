"use client";

import { useEffect, useState } from "react";
import { Cookie } from "lucide-react";

const STORAGE_KEY = "jobsai_cookie_consent"; // "accepted" | "rejected"

function persist(choice: "accepted" | "rejected") {
  try {
    localStorage.setItem(STORAGE_KEY, choice);
  } catch { /* private browsing — fall back to cookie only */ }
  // Mirror to a 1-year cookie so server/analytics can read consent if needed.
  const exp = new Date(Date.now() + 365 * 86_400_000).toUTCString();
  document.cookie = `${STORAGE_KEY}=${choice}; path=/; expires=${exp}; SameSite=Lax`;
}

export function CookieConsent() {
  // Start hidden; reveal only after we confirm no prior choice (avoids SSR flash).
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let chosen = false;
    try {
      chosen = !!localStorage.getItem(STORAGE_KEY);
    } catch { /* ignore */ }
    if (!chosen) chosen = document.cookie.includes(`${STORAGE_KEY}=`);
    if (chosen) return;
    // Defer the reveal a beat so it eases in after first paint (and to keep the
    // setState out of the synchronous effect body).
    const t = setTimeout(() => setVisible(true), 600);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;

  const decide = (choice: "accepted" | "rejected") => {
    persist(choice);
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
      className="fixed bottom-4 left-4 z-[300] w-[calc(100%-2rem)] max-w-sm animate-in fade-in slide-in-from-bottom-4 rounded-2xl border border-border bg-card/95 p-5 shadow-2xl backdrop-blur duration-300"
    >
      <div className="flex items-center gap-2">
        <Cookie className="h-5 w-5 text-primary" />
        <h2 className="text-base font-bold text-foreground">We value your privacy</h2>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        We use cookies to enhance your browsing experience and analyze site traffic. By clicking
        &ldquo;Accept All&rdquo;, you consent to our use of cookies.
      </p>
      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          onClick={() => decide("rejected")}
          className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          Reject All
        </button>
        <button
          onClick={() => decide("accepted")}
          className="btn-cta inline-flex h-9 items-center justify-center rounded-lg px-4 text-sm"
        >
          Accept All
        </button>
      </div>
    </div>
  );
}
