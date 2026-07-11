"use client";

// Cost-confirming reveal control for an external result row. Shows the credit
// price up-front, calls /reveal, and reports the revealed value (or a refund
// notice) back to the parent.
import { useState } from "react";
import { Coins, Loader2, Mail, Phone, ShieldCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RevealOutcome {
  resultId: string;
  type: "email" | "phone";
  value: string;
  verification_status?: string | null;
}

export default function RevealButton({
  resultId,
  type,
  available,
  cost,
  onRevealed,
}: {
  resultId: string;
  type: "email" | "phone";
  available: boolean | null;
  cost: number;
  onRevealed: (o: RevealOutcome) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const Icon = type === "email" ? Mail : Phone;

  const reveal = async () => {
    setLoading(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/enterprise/sourcing/results/${resultId}/reveal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const json = await res.json();
      if (res.status === 402) {
        setNotice(`Not enough credits (balance ${json.balance}).`);
        return;
      }
      if (res.status === 404 && json.no_data) {
        setNotice("No data found — credits refunded.");
        return;
      }
      if (!res.ok) {
        setNotice(json.error ?? "Reveal failed.");
        return;
      }
      const value = json.data.value ?? json.data.already?.value;
      if (value ?? json.data.already) {
        onRevealed({
          resultId,
          type,
          value: json.data.value ?? "",
          verification_status: json.data.verification_status,
        });
      }
      setConfirming(false);
    } catch {
      setNotice("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  if (available === false) {
    return (
      <span className="inline-flex cursor-not-allowed items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] text-muted-foreground/50">
        <Icon className="h-3 w-3" /> No {type}
      </span>
    );
  }

  return (
    <span className="relative inline-flex">
      <button
        onClick={(e) => { e.stopPropagation(); setConfirming((c) => !c); }}
        className={cn(
          "inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors",
          confirming ? "border-primary/50 text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
        )}
      >
        <Icon className="h-3 w-3" /> Reveal {type}
      </button>

      {confirming && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-8 z-30 w-56 rounded-xl border border-border bg-card p-3 shadow-2xl"
        >
          <div className="mb-2 flex items-center justify-between">
            <p className="inline-flex items-center gap-1 text-xs font-semibold">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Reveal {type}
            </p>
            <button onClick={() => { setConfirming(false); setNotice(null); }} aria-label="Close">
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
          <p className="mb-2 text-[11px] leading-snug text-muted-foreground">
            {type === "email"
              ? "Fetches and verifies this candidate's email from the data provider."
              : "Fetches this candidate's phone number from the data provider."}{" "}
            Refunded automatically if nothing is found.
          </p>
          {notice && <p className="mb-2 text-[11px] text-amber-400">{notice}</p>}
          <button
            onClick={reveal}
            disabled={loading}
            className="btn-cta inline-flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Coins className="h-3.5 w-3.5" />}
            {loading ? "Revealing…" : `Reveal for ${cost} credit${cost !== 1 ? "s" : ""}`}
          </button>
        </div>
      )}
    </span>
  );
}
