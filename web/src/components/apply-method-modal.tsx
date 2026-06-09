"use client";

import Link from "next/link";
import { X, Puzzle, Moon, Check, Loader2 } from "lucide-react";

export interface ApplyMethodProps {
  open: boolean;
  onClose: () => void;
  /** Proceed with the autonomous (server-side / Skyvern) apply. */
  onSleep: () => void;
  quantity: number;
  extCost: number;     // credits per extension apply
  sleepCost: number;   // credits per autonomous apply
  balance: number;
  dailyCap: number;    // extension daily fair-use cap for the plan
  busy?: boolean;
}

// Shown when the extension isn't installed — sells BOTH apply methods:
//   • Extension = high daily volume, cheap, runs in your browser
//   • Autonomous "while you sleep" = premium, no browser needed, more credits
export function ApplyMethodModal({
  open, onClose, onSleep, quantity, extCost, sleepCost, balance, dailyCap, busy = false,
}: ApplyMethodProps) {
  if (!open) return null;

  const sleepTotal = sleepCost * quantity;
  const canSleep = balance >= sleepTotal;
  const noun = quantity === 1 ? "job" : `${quantity} jobs`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={busy ? undefined : onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <button onClick={onClose} disabled={busy} className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:text-foreground disabled:opacity-50">
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-lg font-bold">How do you want to apply to {noun}?</h2>
        <p className="mt-1 text-sm text-muted-foreground">Two ways to auto-apply — pick what fits.</p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {/* Extension — high volume, cheap */}
          <div className="flex flex-col rounded-xl border border-primary/40 bg-primary/5 p-4">
            <div className="flex items-center gap-2">
              <Puzzle className="h-5 w-5 text-primary" />
              <span className="font-semibold">Apply on autopilot</span>
            </div>
            <span className="mt-1 inline-block w-fit rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">Best for volume</span>
            <ul className="mt-3 flex-1 space-y-1.5 text-xs text-muted-foreground">
              <li className="flex gap-1.5"><Check className="h-3.5 w-3.5 shrink-0 text-desyn-success" /> Applies from <strong>your browser</strong></li>
              <li className="flex gap-1.5"><Check className="h-3.5 w-3.5 shrink-0 text-desyn-success" /> Only <strong>{extCost} credits</strong> per job</li>
              <li className="flex gap-1.5"><Check className="h-3.5 w-3.5 shrink-0 text-desyn-success" /> Up to <strong>{dailyCap}/day</strong></li>
            </ul>
            <Link href="/dashboard/extension" onClick={onClose} className="btn-cta mt-4 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold">
              <Puzzle className="h-4 w-4" /> Install the extension
            </Link>
          </div>

          {/* Autonomous — premium, while you sleep */}
          <div className="flex flex-col rounded-xl border border-border bg-background/40 p-4">
            <div className="flex items-center gap-2">
              <Moon className="h-5 w-5 text-foreground/70" />
              <span className="font-semibold">Apply while you sleep</span>
            </div>
            <span className="mt-1 inline-block w-fit rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">Hands-off</span>
            <ul className="mt-3 flex-1 space-y-1.5 text-xs text-muted-foreground">
              <li className="flex gap-1.5"><Check className="h-3.5 w-3.5 shrink-0 text-desyn-success" /> Runs on <strong>our servers</strong> — no browser</li>
              <li className="flex gap-1.5"><Check className="h-3.5 w-3.5 shrink-0 text-desyn-success" /> <strong>{sleepCost} credits</strong> per job ({sleepTotal} total)</li>
              <li className="flex gap-1.5"><Check className="h-3.5 w-3.5 shrink-0 text-desyn-success" /> Fully autonomous, anytime</li>
            </ul>
            {canSleep ? (
              <button onClick={onSleep} disabled={busy} className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-60">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} Use {sleepTotal} credits
              </button>
            ) : (
              <Link href="/dashboard/billing" onClick={onClose} className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold hover:bg-muted">
                Top up ({sleepTotal} needed)
              </Link>
            )}
          </div>
        </div>

        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          Tip: the extension is the cheapest way to apply at volume. Save “while you sleep” for hands-off, overnight runs.
        </p>
      </div>
    </div>
  );
}
