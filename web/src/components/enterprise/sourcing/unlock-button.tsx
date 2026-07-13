"use client";

// Full Contact Unlock (bundle) control. Shows the PROGRESSIVE price — the bundle
// cost minus what the org already paid to reveal email/phone on this candidate —
// and calls /unlock. The server computes the authoritative charge.
import { useState } from "react";
import { Coins, Loader2, Unlock, ShieldCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface UnlockOutcome {
  resultId: string;
  email: string | null;
  email_verification: string | null;
  phone: string | null;
  linkedin_url: string | null;
}

export default function UnlockContactButton({
  resultId, emailRevealed, phoneRevealed, hasPhone, costs, onUnlocked,
}: {
  resultId: string;
  emailRevealed: boolean;
  phoneRevealed: boolean;
  hasPhone: boolean | null;
  costs: { reveal_email: number; reveal_phone: number; full_contact_unlock: number };
  onUnlocked: (o: UnlockOutcome) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [needCredits, setNeedCredits] = useState(false);

  // Progressive display price. Target is the bundle when a phone is expected,
  // else the email rate; minus what's already been paid on this candidate.
  const alreadySpent = (emailRevealed ? costs.reveal_email : 0) + (phoneRevealed ? costs.reveal_phone : 0);
  const target = hasPhone === false ? costs.reveal_email : costs.full_contact_unlock;
  const price = Math.max(0, target - alreadySpent);
  const partial = emailRevealed || phoneRevealed;

  const unlock = async () => {
    setLoading(true); setNotice(null); setNeedCredits(false);
    try {
      const res = await fetch(`/api/enterprise/sourcing/results/${resultId}/unlock`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const json = await res.json().catch(() => ({}));
      if (res.status === 402) { setNotice(json.daily_cap ? "Daily credit cap reached." : `Not enough credits (balance ${json.balance}).`); setNeedCredits(!json.daily_cap); return; }
      if (res.status === 404 && json.no_data) { setNotice("No contact data found — no credits charged."); return; }
      if (res.status === 409 && json.do_not_contact) { setNotice("On your Do-Not-Contact list — not unlocked, no charge."); return; }
      if (!res.ok) { setNotice(json.error ?? "Unlock failed."); return; }
      const d = json.data ?? {};
      onUnlocked({ resultId, email: d.email ?? null, email_verification: d.email_verification ?? null, phone: d.phone ?? null, linkedin_url: d.linkedin_url ?? null });
      setConfirming(false);
    } catch {
      setNotice("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <span className="relative inline-flex">
      <button
        onClick={(e) => { e.stopPropagation(); setConfirming((v) => !v); }}
        className={cn(
          "inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors",
          confirming ? "border-primary/50 text-primary" : "border-primary/30 text-primary hover:border-primary/60",
        )}
      >
        <Unlock className="h-3 w-3" /> {partial ? "Complete unlock" : "Unlock contact"}
      </button>

      {confirming && (
        <div onClick={(e) => e.stopPropagation()} className="absolute right-0 top-8 z-30 w-60 rounded-xl border border-border bg-card p-3 shadow-2xl">
          <div className="mb-2 flex items-center justify-between">
            <p className="inline-flex items-center gap-1 text-xs font-semibold"><ShieldCheck className="h-3.5 w-3.5 text-primary" /> Unlock full contact</p>
            <button onClick={() => { setConfirming(false); setNotice(null); }} aria-label="Close"><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
          </div>
          <p className="mb-2 text-[11px] leading-snug text-muted-foreground">
            Reveals the verified email, phone{hasPhone === false ? " (none on file)" : ""}, and LinkedIn profile — and enables export &amp; campaign enrollment.
            {partial && " You're only charged the difference from what you've already revealed."} Refunded if nothing usable is found.
          </p>
          {notice && <p className="mb-2 text-[11px] text-amber-400">{notice}</p>}
          {needCredits && (
            <a href="/enterprise/sourcing/credits" className="mb-2 flex items-center justify-center gap-1 rounded-lg border border-primary/40 py-1.5 text-[11px] font-semibold text-primary hover:bg-primary/10">
              <Coins className="h-3 w-3" /> Top up credits →
            </a>
          )}
          <button onClick={unlock} disabled={loading} className="btn-cta inline-flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold disabled:opacity-60">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Coins className="h-3.5 w-3.5" />}
            {loading ? "Unlocking…" : price === 0 ? "Unlock (included)" : `Unlock for ${price} credit${price !== 1 ? "s" : ""}`}
          </button>
        </div>
      )}
    </span>
  );
}
