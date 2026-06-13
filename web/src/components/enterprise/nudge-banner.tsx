"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, ArrowUpRight, AlertTriangle, Sparkles, Info } from "lucide-react";

interface Nudge { id: string; message: string; cta: string; href: string; tone: "warn" | "info" | "upsell" }

const TONE: Record<Nudge["tone"], { bar: string; icon: typeof Info }> = {
  warn: { bar: "border-amber-300 bg-amber-50 text-amber-900", icon: AlertTriangle },
  info: { bar: "border-blue-200 bg-blue-50 text-blue-900", icon: Info },
  upsell: { bar: "border-primary/30 bg-primary/5 text-foreground", icon: Sparkles },
};

const KEY = "ent-nudges-dismissed";
const DAY = 86_400_000;

function dismissedMap(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; }
}

export function NudgeBanner() {
  const [nudge, setNudge] = useState<Nudge | null>(null);

  useEffect(() => {
    fetch("/api/enterprise/me/nudges")
      .then((r) => r.json())
      .then((j) => {
        const dis = dismissedMap();
        const now = Date.now();
        const next = (j.data as Nudge[] | undefined)?.find((n) => !dis[n.id] || dis[n.id] < now);
        setNudge(next ?? null);
      })
      .catch(() => {});
  }, []);

  if (!nudge) return null;
  const tone = TONE[nudge.tone];
  const Icon = tone.icon;

  const dismiss = () => {
    const dis = dismissedMap();
    dis[nudge.id] = Date.now() + DAY; // snooze 24h
    try { localStorage.setItem(KEY, JSON.stringify(dis)); } catch {}
    setNudge(null);
  };

  return (
    <div className={`flex items-center gap-3 border-b px-4 py-2.5 text-sm ${tone.bar} print:hidden`}>
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{nudge.message}</span>
      <Link href={nudge.href} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white/70 px-3 py-1 text-xs font-semibold hover:bg-white">
        {nudge.cta} <ArrowUpRight className="h-3 w-3" />
      </Link>
      <button onClick={dismiss} className="shrink-0 rounded p-1 hover:bg-black/5" aria-label="Dismiss">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
