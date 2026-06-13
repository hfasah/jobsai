"use client";

import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";

export function AddonButton({
  featureKey, active, price, isSeat, currentQty,
}: { featureKey: string; active: boolean; price: number; isSeat?: boolean; currentQty?: number }) {
  const [loading, setLoading] = useState(false);
  const [qty, setQty] = useState(currentQty && currentQty > 0 ? currentQty : 1);
  const [err, setErr] = useState("");

  const call = async (action: "activate" | "remove", body?: object) => {
    setLoading(true); setErr("");
    try {
      const res = await fetch(`/api/enterprise/addons/${featureKey}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const j = await res.json();
      if (!res.ok) {
        if (j.redirect) { window.location.href = j.redirect; return; }
        setErr(j.error ?? "Something went wrong."); return;
      }
      window.location.reload();
    } catch { setErr("Something went wrong."); } finally { setLoading(false); }
  };

  const primary = "inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-brand px-4 py-2 text-sm font-semibold text-white shadow-glow disabled:opacity-60";
  const ghost = "inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-60";

  if (isSeat) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <input type="number" min={1} value={qty} disabled={loading}
          onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
          className="w-16 rounded-lg border border-border bg-background px-2 py-1.5 text-sm" />
        <button onClick={() => call("activate", { quantity: qty })} disabled={loading} className={primary}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {active ? "Update" : "Add"} · ${price * qty}/mo
        </button>
        {active && <button onClick={() => call("remove")} disabled={loading} className={ghost}>Remove</button>}
        {err && <span className="w-full text-xs text-destructive">{err}</span>}
      </div>
    );
  }

  if (active) {
    return (
      <div className="flex items-center gap-2">
        <button onClick={() => call("remove")} disabled={loading} className={ghost}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Remove
        </button>
        {err && <span className="text-xs text-destructive">{err}</span>}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <button onClick={() => call("activate")} disabled={loading} className={primary}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add · ${price}/mo
      </button>
      {err && <span className="text-xs text-destructive">{err}</span>}
    </div>
  );
}
