"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

// Self-serve plan button → starts Stripe Checkout (14-day trial).
export function ChoosePlan({ slug, popular, interval = "month" }: { slug: string; popular?: boolean; interval?: "month" | "year" }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const start = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/enterprise/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_slug: slug, interval }),
      });
      const json = await res.json();
      if (!res.ok || !json.url) {
        setError(json.error ?? "Could not start checkout.");
        return;
      }
      window.location.href = json.url;
    } catch {
      setError("Could not start checkout.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={start}
        disabled={loading}
        className={
          "flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold disabled:opacity-60 " +
          (popular
            ? "bg-gradient-brand text-white shadow-glow"
            : "border border-border bg-card text-foreground hover:bg-muted")
        }
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading ? "Starting…" : "Start 14-day trial"}
      </button>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </>
  );
}
