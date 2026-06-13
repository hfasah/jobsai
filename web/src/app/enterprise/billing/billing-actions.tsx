"use client";

import { useState } from "react";
import { Loader2, ExternalLink } from "lucide-react";

export function ManageBilling({ hasBilling }: { hasBilling: boolean }) {
  const [loading, setLoading] = useState(false);

  const open = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/enterprise/billing-portal", { method: "POST" });
      const json = await res.json();
      if (json.url) { window.location.href = json.url; return; }
      window.location.href = json.redirect ?? "/enterprise/plans";
    } catch {
      window.location.href = "/enterprise/plans";
    } finally {
      setLoading(false);
    }
  };

  if (!hasBilling) {
    return (
      <a href="/enterprise/plans" className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-brand px-5 py-2.5 text-sm font-semibold text-white shadow-glow">
        Choose a plan
      </a>
    );
  }
  return (
    <div className="flex flex-wrap gap-3">
      <button onClick={open} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-brand px-5 py-2.5 text-sm font-semibold text-white shadow-glow disabled:opacity-60">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
        Manage billing & plan
      </button>
      <a href="/enterprise/plans" className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold hover:bg-muted">
        Change plan
      </a>
    </div>
  );
}
