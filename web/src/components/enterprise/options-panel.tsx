"use client";

// Per-campaign options: deliverability + dedup controls. Opened as a modal.
import { useEffect, useState } from "react";
import { SlidersHorizontal, Loader2, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Options { track_opens: boolean; dedup_days: number | null; allow_unverified: boolean }

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", on ? "bg-primary" : "bg-muted")}>
      <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all", on ? "left-[18px]" : "left-0.5")} />
    </button>
  );
}

export default function OptionsPanel({ campaignId, campaignName, onClose, embedded = false }: { campaignId: string; campaignName: string; onClose: () => void; embedded?: boolean }) {
  const base = `/api/enterprise/campaigns/${campaignId}/options`;
  const [loading, setLoading] = useState(true);
  const [opt, setOpt] = useState<Options | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(base).then((r) => r.json()).then((j) => setOpt(j.data ?? { track_opens: true, dedup_days: null, allow_unverified: true })).catch(() => {}).finally(() => setLoading(false));
  }, [base]);

  const patch = (p: Partial<Options>) => setOpt((o) => (o ? { ...o, ...p } : o));

  const save = async () => {
    if (!opt) return;
    setSaving(true); setSaved(false);
    await fetch(base, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(opt) }).catch(() => {});
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div
      className={embedded ? "overflow-hidden rounded-2xl border border-border bg-card" : "fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"}
      onClick={embedded ? undefined : onClose}
    >
      <div onClick={(e) => e.stopPropagation()} className={embedded ? "flex w-full flex-col" : "flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"}>
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="flex items-center gap-2 font-semibold"><SlidersHorizontal className="h-4 w-4 text-primary" /> Options{!embedded && <> — <span className="text-muted-foreground">{campaignName}</span></>}</h2>
          {!embedded && <button onClick={onClose} aria-label="Close"><X className="h-4 w-4 text-muted-foreground" /></button>}
        </div>

        {loading || !opt ? (
          <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Open tracking</p>
                <p className="text-[11px] text-muted-foreground">Adds an invisible pixel to measure opens. Turning it off improves deliverability (and opens are unreliable anyway).</p>
              </div>
              <Toggle on={opt.track_opens} onClick={() => patch({ track_opens: !opt.track_opens })} />
            </div>

            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Allow unverified emails</p>
                <p className="text-[11px] text-muted-foreground">When off, only verified or likely-valid addresses can be added to this campaign.</p>
              </div>
              <Toggle on={opt.allow_unverified} onClick={() => patch({ allow_unverified: !opt.allow_unverified })} />
            </div>

            <div>
              <p className="text-sm font-medium">Don&apos;t re-contact within</p>
              <p className="mb-1.5 text-[11px] text-muted-foreground">Skip adding a lead who was contacted in any campaign in the last N days. Leave blank to allow.</p>
              <div className="flex items-center gap-2">
                <input
                  type="number" min={0} max={365}
                  value={opt.dedup_days ?? ""}
                  onChange={(e) => patch({ dedup_days: e.target.value ? Math.max(0, Math.min(365, Number(e.target.value))) : null })}
                  placeholder="off"
                  className="w-24 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <span className="text-sm text-muted-foreground">days</span>
              </div>
            </div>
          </div>
        )}

        {opt && (
          <div className="flex justify-end border-t border-border p-3">
            <button onClick={save} disabled={saving} className="btn-cta inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null}
              {saved ? "Saved" : "Save options"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
