"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, X, ArrowRight, Rocket } from "lucide-react";

interface Step { key: string; label: string; done: boolean; href: string }
interface Status { steps: Step[]; complete: number; total: number }

const KEY = "ent-onboarding-dismissed";

export function OnboardingChecklist() {
  const [status, setStatus] = useState<Status | null>(null);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem(KEY) === "1") return;
    setHidden(false);
    fetch("/api/enterprise/me/onboarding")
      .then((r) => r.json())
      .then((j) => setStatus(j.data ?? null))
      .catch(() => {});
  }, []);

  // Hide once everything's done (or dismissed / not loaded).
  if (hidden || !status || status.complete >= status.total) return null;

  const pct = Math.round((status.complete / status.total) * 100);
  const dismiss = () => { try { localStorage.setItem(KEY, "1"); } catch {} setHidden(true); };

  return (
    <div className="relative mb-6 rounded-2xl border border-border bg-card p-5">
      <button onClick={dismiss} aria-label="Dismiss" className="absolute right-3 top-3 rounded p-1 text-muted-foreground hover:bg-muted">
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-brand"><Rocket className="h-5 w-5 text-white" /></div>
        <div>
          <h2 className="font-bold">Welcome to JobsAI Enterprise</h2>
          <p className="text-sm text-muted-foreground">Finish setting up your recruiting workspace.</p>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-muted-foreground">{status.complete} / {status.total} complete</span>
          <span className="text-muted-foreground">{pct}%</span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-gradient-brand transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <ul className="mt-4 space-y-1">
        {status.steps.map((s) => (
          <li key={s.key}>
            {s.done ? (
              <div className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                <span className="text-muted-foreground line-through">{s.label}</span>
              </div>
            ) : (
              <Link href={s.href} className="group flex items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-muted">
                <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />
                <span className="flex-1 font-medium">{s.label}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
