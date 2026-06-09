"use client";

import { useState } from "react";
import Link from "next/link";
import { Lock, X, Zap, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlan, isPaidPlan } from "@/hooks/use-plan";

interface UpgradeGateProps {
  /** Feature name shown in the modal */
  feature: string;
  /** One-line explanation of what they're missing */
  description: string;
  /** The button/element to render when gated */
  lockedElement?: React.ReactNode;
  /** The children to render when the user has access */
  children: React.ReactNode;
  className?: string;
}

/** Wraps any element. Free users see a lock + modal nudge; paid users see the real thing. */
export function UpgradeGate({ feature, description, lockedElement, children, className }: UpgradeGateProps) {
  const { plan, loading } = usePlan();
  const [showModal, setShowModal] = useState(false);

  if (loading) return null;
  if (isPaidPlan(plan)) return <>{children}</>;

  return (
    <>
      <div className={cn("relative", className)} onClick={() => setShowModal(true)}>
        {lockedElement ?? (
          <div className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-muted px-3 py-1.5 text-sm font-medium text-muted-foreground opacity-70 hover:opacity-100 transition-opacity">
            <Lock className="h-3.5 w-3.5" />
            {feature}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl">
            <button
              onClick={() => setShowModal(false)}
              className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Zap className="h-6 w-6 text-primary" />
            </div>

            <h2 className="mt-4 text-lg font-bold">{feature}</h2>
            <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{description}</p>

            <div className="mt-4 rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">What you get with a paid plan:</p>
              <p>✓ Autonomous agent applies while you sleep</p>
              <p>✓ Up to 240 applications per day</p>
              <p>✓ Full resume tailoring + cover letters for every job</p>
              <p>✓ Live interview agent (real-time answers during your call)</p>
            </div>

            <div className="mt-5 flex flex-col gap-2.5">
              <Link
                href="/dashboard/billing"
                onClick={() => setShowModal(false)}
                className="btn-cta flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"
              >
                <Sparkles className="h-4 w-4" /> View plans &amp; upgrade
              </Link>
              <Link
                href="/dashboard/billing"
                onClick={() => setShowModal(false)}
                className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Or buy a token pack to get started
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Inline locked badge — lighter weight than full gate, for use inside lists */
export function LockedBadge({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
    >
      <Lock className="h-3 w-3" /> {label}
    </button>
  );
}
