"use client";

import Link from "next/link";
import { AlertTriangle, X, Info, Loader2 } from "lucide-react";

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

        <h2 className="text-lg font-bold text-white">Credit Confirmation Required</h2>

        <div className="mt-4 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-400/90">
            <AlertTriangle className="h-5 w-5 text-black" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">This is a paid operation</p>
            <p className="text-xs text-white/50">Credits will be deducted for this action</p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/80">
          <p>This operation will process:</p>
          <p className="mt-2 text-white">
            {action} ({chargeable} {chargeable === 1 ? unitNoun : `${unitNoun}s`} × {unitCost} credits = {total} credits)
          </p>
          {freeUsed > 0 && (
            <p className="mt-1 text-xs text-emerald-300">
              🎁 {freeUsed} free auto-{freeUsed === 1 ? "apply" : "applies"} applied — no credits charged for {freeUsed === 1 ? "it" : "those"}.
            </p>
          )}
          <p className="mt-3">
            Total credits required: <span className="font-semibold text-white">{total}</span>
          </p>
          {note && <p className="mt-1 text-xs text-white/50">{note}</p>}
          <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 text-xs text-white/50">
            <span>Your balance</span>
            <span className={affordable ? "text-white/80" : "text-red-400 font-semibold"}>{balance} credits</span>
          </div>
        </div>

        {affordable ? (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-purple-600/20 px-3 py-2.5 text-xs text-purple-200">
            <Info className="h-4 w-4 shrink-0" />
            {total === 0
              ? "By continuing, no credits will be charged — covered by your free auto-applies."
              : `By continuing, ${total} credits will be deducted from your account.`}
          </div>
        ) : (
          <div className="mt-4 rounded-lg bg-red-500/15 px-3 py-2.5 text-xs text-red-300">
            Not enough credits — you need {total} but have {balance}. Buy a credit bundle to continue.
          </div>
        )}

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
              {total === 0 ? "Proceed (free)" : `Proceed (${total} credits)`}
            </button>
          ) : (
            <Link
              href="/dashboard/billing"
              className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500"
            >
              Buy credits
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
