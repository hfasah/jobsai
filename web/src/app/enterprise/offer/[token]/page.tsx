"use client";

import { use, useEffect, useState, useRef } from "react";
import { FileText, Loader2, CheckCircle2, PenLine, X } from "lucide-react";

type OfferData = {
  id: string;
  candidate_name: string;
  job_title: string;
  content: string;
  status: string;
  signed_at: string | null;
  declined_at: string | null;
  org_name: string;
};

export default function OfferSignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [offer, setOffer] = useState<OfferData | null>(null);
  const [error, setError] = useState("");
  const [signName, setSignName] = useState("");
  const [declineReason, setDeclineReason] = useState("");
  const [showDecline, setShowDecline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<"signed" | "declined" | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/enterprise/offer-sign/${token}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.data) {
          setOffer(j.data);
          if (j.data.status === "signed") setDone("signed");
          if (j.data.status === "declined") setDone("declined");
        } else {
          setError(j.error ?? "Offer not found.");
        }
      });
  }, [token]);

  const handleSign = async () => {
    if (!signName.trim()) { nameRef.current?.focus(); return; }
    setBusy(true);
    const res = await fetch(`/api/enterprise/offer-sign/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signed_by_name: signName.trim() }),
    });
    const j = await res.json();
    if (res.ok) { setDone("signed"); setOffer((o) => o ? { ...o, status: "signed", signed_at: j.data.signed_at } : o); }
    else { setError(j.error ?? "Failed to sign."); }
    setBusy(false);
  };

  const handleDecline = async () => {
    setBusy(true);
    const res = await fetch(`/api/enterprise/offer-sign/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "decline", decline_reason: declineReason.trim() || undefined }),
    });
    const j = await res.json();
    if (res.ok) { setDone("declined"); setOffer((o) => o ? { ...o, status: "declined" } : o); }
    else { setError(j.error ?? "Failed to decline."); }
    setBusy(false);
  };

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="text-center">
          <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!offer) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-brand shadow-glow">
            <FileText className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">{offer.org_name}</h1>
            <p className="text-sm text-muted-foreground">Offer Letter · {offer.job_title}</p>
          </div>
        </div>

        {/* Offer content */}
        <div
          className="rounded-2xl border border-border bg-card p-6 text-sm leading-relaxed text-foreground prose prose-sm max-w-none dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: offer.content }}
        />

        {/* Signed / Declined state */}
        {done === "signed" && (
          <div className="mt-6 flex items-center gap-3 rounded-2xl border border-green-500/30 bg-green-500/10 p-4 text-sm font-medium text-green-400">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Offer signed — congratulations!</p>
              {offer.signed_at && (
                <p className="mt-0.5 text-xs text-green-400/70">
                  Signed on {new Date(offer.signed_at).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        )}

        {done === "declined" && (
          <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
            <p className="font-semibold">You have declined this offer.</p>
            <p className="mt-0.5 text-xs text-red-400/70">The recruiting team has been notified.</p>
          </div>
        )}

        {/* Sign / Decline actions */}
        {offer.status === "sent" && !done && (
          <div className="mt-6 space-y-4 rounded-2xl border border-border bg-card p-5">
            <p className="text-sm font-medium text-foreground">
              By typing your full name and clicking <strong>Sign Offer</strong>, you agree to accept
              this offer under the terms described above. This constitutes a legally binding electronic
              signature under the U.S. ESIGN Act and equivalent laws.
            </p>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Full name (type to sign)
              </label>
              <input
                ref={nameRef}
                type="text"
                value={signName}
                onChange={(e) => setSignName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSign()}
                placeholder={offer.candidate_name}
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSign}
                disabled={busy || !signName.trim()}
                className="btn-cta flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />}
                Sign Offer
              </button>
              <button
                onClick={() => setShowDecline((v) => !v)}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-60"
              >
                <X className="h-3.5 w-3.5" /> Decline
              </button>
            </div>

            {showDecline && (
              <div className="space-y-2 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                <p className="text-xs font-medium text-red-400">Are you sure you want to decline this offer?</p>
                <textarea
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  placeholder="Reason (optional)"
                  rows={2}
                  className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleDecline}
                    disabled={busy}
                    className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    {busy ? "Declining…" : "Confirm Decline"}
                  </button>
                  <button onClick={() => setShowDecline(false)} className="rounded-lg border border-border px-4 py-2 text-xs text-muted-foreground hover:bg-muted">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Already withdrawn/other status */}
        {!["sent", "signed", "declined"].includes(offer.status) && (
          <div className="mt-6 rounded-2xl border border-border bg-card p-4 text-center text-sm text-muted-foreground">
            This offer is no longer available for signing.
          </div>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Powered by{" "}
          <a href="https://jobsai.work" className="text-primary hover:underline">
            JobsAI.Work
          </a>
        </p>
      </div>
    </div>
  );
}
