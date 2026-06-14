"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Copy, Check, ArrowRight, Banknote } from "lucide-react";

// Join the program (creates the partner account, then reloads into the dashboard).
export function JoinForm() {
  const router = useRouter();
  const [company, setCompany] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const join = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/enterprise/partner/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_name: company.trim() || null }),
      });
      if (!r.ok) {
        setError((await r.json().catch(() => ({}))).error ?? "Could not join.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not join.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <label className="mb-1.5 block text-sm font-medium">Company / your name <span className="text-muted-foreground">(optional)</span></label>
      <input
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        placeholder="Acme Advisory"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      />
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      <button
        onClick={join}
        disabled={busy}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-brand px-6 py-3 text-sm font-semibold text-white shadow-glow disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
        Join the Partner Program
      </button>
    </div>
  );
}

// Copyable referral link.
export function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 truncate rounded-lg border border-border bg-background px-3 py-2 text-sm">{link}</code>
      <button
        onClick={copy}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted"
      >
        {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

// Start / resume Stripe Connect onboarding for payouts.
export function ConnectButton({ connected }: { connected: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const start = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/enterprise/partner/connect", { method: "POST" });
      const j = await r.json();
      if (!r.ok || !j.url) {
        setError(j.error ?? "Could not start payout setup.");
        return;
      }
      window.location.href = j.url;
    } catch {
      setError("Could not start payout setup.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <button
        onClick={start}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold hover:bg-muted disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />}
        {connected ? "Manage payout details" : "Set up payouts"}
      </button>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}
