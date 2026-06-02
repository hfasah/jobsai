"use client";

import { useState } from "react";
import { DollarSign, Loader2, RefreshCw, TrendingUp, Lightbulb, Info, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/job/ats-report";
import { cn } from "@/lib/utils";
import type { SalaryIntelResult, SalaryFactor } from "@/app/api/jobs/[jobId]/salary-intel/route";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, currency: string): string {
  if (currency === "USD" || currency === "CAD" || currency === "AUD") {
    return n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`;
  }
  if (currency === "GBP") return n >= 1000 ? `£${Math.round(n / 1000)}k` : `£${n}`;
  if (currency === "EUR") return n >= 1000 ? `€${Math.round(n / 1000)}k` : `€${n}`;
  return n >= 1000 ? `${Math.round(n / 1000)}k ${currency}` : `${n} ${currency}`;
}

// ─── Range bar ────────────────────────────────────────────────────────────────

function RangeBar({ result }: { result: SalaryIntelResult }) {
  const { p25, p50, p75, range_min, range_max, currency } = result;

  // Chart bounds — 10% padding outside p25/p75
  const span = p75 - p25;
  const lo = Math.min(range_min, p25) - span * 0.1;
  const hi = Math.max(range_max, p75) + span * 0.1;
  const total = hi - lo;

  const pct = (v: number) => `${Math.max(0, Math.min(100, ((v - lo) / total) * 100)).toFixed(1)}%`;

  const markers = [
    { value: p25, label: "P25", color: "bg-muted-foreground/40" },
    { value: p50, label: "P50 (median)", color: "bg-primary" },
    { value: p75, label: "P75", color: "bg-muted-foreground/40" },
  ];

  return (
    <div className="space-y-3">
      {/* Bar */}
      <div className="relative h-8">
        {/* Background track */}
        <div className="absolute inset-y-3 inset-x-0 rounded-full bg-muted" />

        {/* P25–P75 filled band */}
        <div
          className="absolute inset-y-3 rounded-full bg-primary/20"
          style={{ left: pct(p25), right: `${100 - parseFloat(pct(p75))}%` }}
        />

        {/* Marker ticks */}
        {markers.map(({ value, color }) => (
          <div
            key={value}
            className={cn("absolute top-1.5 h-5 w-0.5 rounded-full", color)}
            style={{ left: pct(value) }}
          />
        ))}

        {/* Median dot */}
        <div
          className="absolute top-2 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-primary bg-white shadow-sm"
          style={{ left: pct(p50) }}
        />
      </div>

      {/* Labels row */}
      <div className="relative h-5 text-xs text-muted-foreground">
        {markers.map(({ value, label }) => (
          <span
            key={value}
            className="absolute -translate-x-1/2 whitespace-nowrap font-medium"
            style={{ left: pct(value) }}
          >
            {fmt(value, currency)}
          </span>
        ))}
      </div>

      {/* P-label row */}
      <div className="relative h-4 text-[10px] text-muted-foreground/70">
        {markers.map(({ value, label }) => (
          <span
            key={label}
            className="absolute -translate-x-1/2 whitespace-nowrap"
            style={{ left: pct(value) }}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Factor chip ──────────────────────────────────────────────────────────────

function FactorChip({ factor }: { factor: SalaryFactor }) {
  const [open, setOpen] = useState(false);
  const isPositive = factor.value.startsWith("+");
  const isNeutral = !factor.value.startsWith("+") && !factor.value.startsWith("-");

  return (
    <button
      onClick={() => setOpen((v) => !v)}
      className="rounded-xl border border-border bg-card px-3.5 py-2.5 text-left transition-colors hover:bg-muted/40"
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">{factor.label}</span>
        <span className={cn(
          "ml-auto rounded-full px-2 py-0.5 text-xs font-bold",
          isNeutral  ? "bg-muted text-muted-foreground" :
          isPositive ? "bg-desyn-success/10 text-desyn-success" :
                       "bg-destructive/10 text-destructive"
        )}>
          {factor.value}
        </span>
        <ChevronRight className={cn("h-3 w-3 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} />
      </div>
      {open && (
        <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{factor.note}</p>
      )}
    </button>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function SalaryIntelView({ jobId }: { jobId: string }) {
  const [result, setResult] = useState<SalaryIntelResult | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [generating, setGenerating] = useState(false);

  if (!loaded) {
    setLoaded(true);
    fetch(`/api/jobs/${jobId}/salary-intel`)
      .then((r) => r.json())
      .then((j) => { if (j.data) setResult(j.data); })
      .catch(() => null);
  }

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/salary-intel`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) { alert(json.error ?? "Analysis failed."); return; }
      setResult(json.data);
    } finally {
      setGenerating(false);
    }
  };

  if (generating) {
    return (
      <div className="flex items-center justify-center gap-3 rounded-xl border border-border bg-card p-12 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        Analysing compensation data…
      </div>
    );
  }

  if (!result) {
    return (
      <EmptyState
        icon={<DollarSign className="h-7 w-7" />}
        title="Salary Intelligence"
        body="Get AI-powered salary estimates, market percentiles, and negotiation tips specific to this role, company, and location."
        cta="Analyse salary"
        onClick={generate}
      />
    );
  }

  const { currency, range_min, range_max, range_median } = result;

  return (
    <div className="space-y-6">

      {/* Header card — main range */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Estimated range</p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-foreground">
              {fmt(range_min, currency)} – {fmt(range_max, currency)}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Median <span className="font-semibold text-foreground">{fmt(range_median, currency)}</span> · Annual base salary
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={generate} disabled={generating}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>

        {/* Range bar */}
        <div className="mt-6">
          <RangeBar result={result} />
        </div>
      </div>

      {/* vs posting */}
      {result.vs_posting && (
        <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
          <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="text-sm text-muted-foreground leading-relaxed">{result.vs_posting}</p>
        </div>
      )}

      {/* Market context */}
      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Market context</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{result.market_context}</p>
      </div>

      {/* Salary factors */}
      {result.factors?.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Pay factors</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {result.factors.map((f, i) => (
              <FactorChip key={i} factor={f} />
            ))}
          </div>
        </div>
      )}

      {/* Negotiation tips */}
      {result.negotiation_tips?.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Negotiation tips</h2>
          <div className="space-y-2">
            {result.negotiation_tips.map((tip, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                  {i + 1}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{tip}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Total comp */}
      {result.total_comp_context && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Total compensation</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{result.total_comp_context}</p>
        </div>
      )}

      {/* Disclaimer */}
      <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <p className="text-xs text-muted-foreground leading-relaxed">{result.data_note}</p>
      </div>

    </div>
  );
}
