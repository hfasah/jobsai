"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Sliders, Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Feat {
  key: string; name: string; category: string | null; is_addon: boolean;
  inPlan: boolean; override: boolean | null; effective: boolean;
}
interface Data {
  planSlug: string | null; planName: string | null;
  plans: { slug: string; name: string }[]; features: Feat[]; addons: string[];
}

// Admin panel: switch an org's plan and force individual features on/off.
export function AdminPlanFeatures({ orgId }: { orgId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(() => {
    fetch(`/api/admin/enterprise/${orgId}/features`)
      .then((r) => r.json())
      .then((j) => { if (j.data) setData(j.data); else setErr(j.error ?? "Failed to load."); });
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const patch = async (body: Record<string, unknown>, key: string) => {
    setBusy(key); setErr("");
    const res = await fetch(`/api/admin/enterprise/${orgId}/features`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const j = await res.json();
    setBusy(null);
    if (!res.ok) { setErr(j.error ?? "Update failed."); return; }
    load();
  };

  if (!data) return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading plan & features…</div>
  );

  // Group features by category, plan features first then add-ons.
  const cats = Array.from(new Set(data.features.map((f) => f.category ?? "Other")));

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <Sliders className="h-4 w-4 text-primary" />
        <h2 className="font-semibold">Plan &amp; feature access</h2>
      </div>

      {/* Plan switcher */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Plan:</span>
        <select
          value={data.planSlug ?? ""}
          disabled={busy === "plan"}
          onChange={(e) => patch({ plan_slug: e.target.value }, "plan")}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {!data.planSlug && <option value="">— none —</option>}
          {data.plans.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
        </select>
        {busy === "plan" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        <span className="ml-auto text-xs text-muted-foreground">
          {data.features.filter((f) => f.effective).length} features enabled
        </span>
      </div>

      {err && <p className="mb-3 text-sm text-destructive">{err}</p>}

      <p className="mb-3 text-xs text-muted-foreground">
        Each feature follows the plan by default. Use <span className="font-medium text-foreground">On</span>/<span className="font-medium text-foreground">Off</span> to override for this org only; <span className="font-medium text-foreground">Default</span> reverts to the plan.
      </p>

      <div className="space-y-5">
        {cats.map((cat) => {
          const rows = data.features.filter((f) => (f.category ?? "Other") === cat);
          return (
            <div key={cat}>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{cat}</p>
              <div className="divide-y divide-border rounded-lg border border-border">
                {rows.map((f) => (
                  <div key={f.key} className="flex items-center gap-3 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {f.name}
                        {f.is_addon && <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-500">ADD-ON</span>}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {f.effective
                          ? <span className="text-green-500">● Enabled</span>
                          : <span>○ Disabled</span>}
                        {" · "}
                        {f.override === null ? `plan default (${f.inPlan ? "included" : "not included"})` : `overridden ${f.override ? "on" : "off"}`}
                      </p>
                    </div>
                    {busy === f.key ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      <div className="flex shrink-0 overflow-hidden rounded-lg border border-border text-xs">
                        <button onClick={() => patch({ feature_key: f.key, state: "on" }, f.key)}
                          className={cn("flex items-center gap-1 px-2 py-1", f.override === true ? "bg-green-500/20 text-green-500 font-semibold" : "hover:bg-muted")}>
                          <Check className="h-3 w-3" /> On
                        </button>
                        <button onClick={() => patch({ feature_key: f.key, state: "off" }, f.key)}
                          className={cn("flex items-center gap-1 border-l border-border px-2 py-1", f.override === false ? "bg-red-500/20 text-red-400 font-semibold" : "hover:bg-muted")}>
                          <Minus className="h-3 w-3" /> Off
                        </button>
                        <button onClick={() => patch({ feature_key: f.key, state: "default" }, f.key)}
                          className={cn("border-l border-border px-2 py-1", f.override === null ? "bg-muted font-semibold" : "hover:bg-muted")}>
                          Default
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
