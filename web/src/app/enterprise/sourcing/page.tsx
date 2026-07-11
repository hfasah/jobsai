"use client";

// JobsAI TalentSource ("Global Sourcing") — find talent anywhere with AI.
// Three modes: Global (external providers), Internal CRM (the original AI
// Talent Rediscovery, unchanged), and Combined. Global/Combined are gated on
// the global_sourcing entitlement with an upgrade CTA.
import { useEffect, useState } from "react";
import { Globe, Database, Layers, Sparkles, Lock } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import InternalRediscovery from "@/components/enterprise/sourcing/internal-rediscovery";
import GlobalSourcing from "@/components/enterprise/sourcing/global-sourcing";

type Mode = "global" | "internal" | "combined";

const MODES: { key: Mode; label: string; icon: typeof Globe; blurb: string }[] = [
  { key: "global",   label: "Global",       icon: Globe,    blurb: "Search external talent sources worldwide" },
  { key: "internal", label: "Internal CRM", icon: Database, blurb: "Rediscover candidates already in your database" },
  { key: "combined", label: "Combined",     icon: Layers,   blurb: "External + internal in one ranked view" },
];

export default function SourcingPage() {
  const [mode, setMode] = useState<Mode>("global");
  const [features, setFeatures] = useState<string[] | null>(null);

  useEffect(() => {
    fetch("/api/enterprise/me/entitlements")
      .then((r) => r.json())
      .then((j) => setFeatures(j.data?.features ?? []))
      .catch(() => setFeatures([]));
  }, []);

  const hasGlobal = features === null || features.includes("global_sourcing");

  return (
    <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-4xl">
        {/* Hero */}
        <div className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Sparkles className="h-6 w-6 text-primary" /> Find talent anywhere with AI
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Describe the candidate you need in plain English. Search the world&apos;s talent data, your own
            CRM, or both — review the AI&apos;s interpretation before anything runs.
          </p>
        </div>

        {/* Mode tabs */}
        <div className="mb-6 grid grid-cols-3 gap-2">
          {MODES.map((m) => {
            const active = mode === m.key;
            const locked = m.key !== "internal" && features !== null && !features.includes("global_sourcing");
            return (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                className={cn(
                  "rounded-2xl border p-3 text-left transition-colors",
                  active ? "border-primary/60 bg-primary/5" : "border-border bg-card hover:border-border/80",
                )}
              >
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  <m.icon className={cn("h-4 w-4", active ? "text-primary" : "text-muted-foreground")} />
                  {m.label}
                  {locked && <Lock className="ml-auto h-3 w-3 text-muted-foreground" />}
                </span>
                <span className="mt-0.5 block text-[11px] leading-tight text-muted-foreground">{m.blurb}</span>
              </button>
            );
          })}
        </div>

        {/* Mode content */}
        {mode === "internal" ? (
          <InternalRediscovery />
        ) : hasGlobal ? (
          <GlobalSourcing mode={mode === "combined" ? "combined" : "external"} />
        ) : (
          <div className="rounded-2xl border border-dashed border-border py-14 text-center">
            <Globe className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
            <h2 className="text-base font-semibold">Global Talent Sourcing is a plan upgrade</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Search licensed external talent data worldwide, reveal verified contact details, and import
              candidates straight into your pipeline. Included on Business plans and available as an add-on.
            </p>
            <Link
              href="/enterprise/billing"
              className="btn-cta mt-4 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold"
            >
              <Sparkles className="h-4 w-4" /> Upgrade to unlock
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
