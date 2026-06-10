"use client";

import Link from "next/link";
import { AlertCircle, X, Info, Loader2 } from "lucide-react";

export interface CreditConfirmProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  /** Human label, e.g. "Auto Apply" */
  action: string;
  /** Credits per unit */
  unitCost: number;
  /** Number of units (e.g. jobs) */
  quantity: number;
  /** Current spendable balance */
  balance: number;
  /** Optional note, e.g. "5 jobs are already applied and will be skipped." */
  note?: string;
  /** Unit noun, default "job" */
  unitNoun?: string;
  /** Lifetime free auto-applies remaining — applied before credits. */
  freeApplies?: number;
  busy?: boolean;
}

export function CreditConfirmModal({
  open,
  onClose,
  onConfirm,
  action,
  unitCost,
  quantity,
  balance,
  note,
  unitNoun = "job",
  freeApplies = 0,
  busy = false,
}: CreditConfirmProps) {
  if (!open) return null;

  const freeUsed = Math.min(quantity, Math.max(0, freeApplies));
  const chargeable = quantity - freeUsed;
  const total = unitCost * chargeable;
  const affordable = balance >= total;
  const noun = quantity === 1 ? unitNoun : `${unitNoun}s`;

  // Dynamic messaging based on balance
  let statusMessage = "";
  let statusColor = "";
  let statusIcon = "";

  if (affordable) {
    statusColor = "bg-emerald-500/15 text-emerald-300";
    statusIcon = "✓";
    if (total === 0) {
      statusMessage = "This action is covered by your free tier. Proceed at no cost.";
    } else if (balance > total * 2) {
      statusMessage = "You have plenty of credits. Ready to proceed.";
    } else {
      statusMessage = "You have enough credits for this. Ready to proceed.";
    }
  } else {
    statusColor = "bg-amber-500/15 text-amber-300";
    statusIcon = "⚡";
    const shortfall = total - balance;
    statusMessage = `Your credits are running low. Upgrade your plan or buy more credits to continue.`;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={busy ? undefined : onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-purple-500/30 bg-[#1a1428] p-6 shadow-2xl">
        <button
          onClick={onClose}
          disabled={busy}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-purple-600 text-white hover:bg-purple-500 disabled:opacity-50"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <h2 className="text-lg font-bold text-white">Confirm Action</h2>

        <div className="mt-4 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-400/90">
            <AlertCircle className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{action}</p>
            <p className="text-xs text-white/50">Premium feature • Credits will be used</p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/80 space-y-2">
          <p>You're about to:</p>
          <p className="text-white font-medium">
            {action} {quantity} {noun}
          </p>
          {freeUsed > 0 && (
            <p className="text-xs text-emerald-300">
              🎁 {freeUsed} free {freeUsed === 1 ? "action" : "actions"} — no credits used
            </p>
          )}
          {note && <p className="text-xs text-white/50 border-t border-white/10 pt-2">{note}</p>}
        </div>

        <div className={`mt-4 rounded-lg px-3 py-2.5 text-xs flex items-start gap-2 ${statusColor}`}>
          <span className="shrink-0 font-bold">{statusIcon}</span>
          <span>{statusMessage}</span>
        </div>

        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/5 disabled:opacity-50"
          >
            Cancel
          </button>
          {affordable ? (
            <button
              onClick={onConfirm}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Proceed
            </button>
          ) : (
            <Link
              href="/dashboard/billing"
              className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500"
            >
              Upgrade
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
