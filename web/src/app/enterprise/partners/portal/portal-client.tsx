"use client";

import { useState } from "react";
import { Loader2, Mail, Copy, Check, Save, LogOut } from "lucide-react";

// Dashboard header actions: re-send the magic link (so they never lose access)
// and "sign out" — which rotates the token so this private link stops working
// (true logout for shared computers); a fresh link is then requested by email.
export function PortalActions({ token, email }: { token: string; email: string }) {
  const [busy, setBusy] = useState<null | "send" | "out">(null);
  const [sent, setSent] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const sendLink = async () => {
    setBusy("send");
    try {
      await fetch("/api/enterprise/partner/portal-link", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }),
      });
      setSent(true);
      setTimeout(() => setSent(false), 4000);
    } finally { setBusy(null); }
  };

  const signOut = async () => {
    setBusy("out");
    try {
      await fetch("/api/enterprise/partner/portal/signout", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }),
      });
      window.location.href = "/enterprise/partners/portal?signedout=1";
    } catch {
      setBusy(null);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <button onClick={sendLink} disabled={busy !== null}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-60">
          {busy === "send" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
          {sent ? "Link emailed" : "Email me this link"}
        </button>
        <button onClick={() => setConfirming(true)} disabled={busy !== null}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-60">
          <LogOut className="h-3.5 w-3.5" /> Sign out
        </button>
      </div>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setConfirming(false)}>
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-muted"><LogOut className="h-5 w-5 text-muted-foreground" /></div>
            <h3 className="text-lg font-bold">You don&apos;t need to sign out to leave</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Your dashboard link <strong>stays active and never expires</strong> — just bookmark it and come back anytime. You won&apos;t get a new link each visit.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Only sign out on a <strong>shared or public computer</strong>. It disables <em>this</em> link so no one else can use it; we&apos;ll email you a fresh one whenever you need it.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button onClick={signOut} disabled={busy === "out"}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60">
                {busy === "out" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />} Sign out & disable this link
              </button>
              <button onClick={() => setConfirming(false)} disabled={busy === "out"}
                className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-60">
                Stay signed in
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Returning partner asks for their dashboard magic link by email.
export function RequestLinkForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await fetch("/api/enterprise/partner/portal-link", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }),
      });
      setSent(true);
    } finally { setBusy(false); }
  };

  if (sent) {
    return (
      <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-6 text-center text-emerald-800">
        <Check className="mx-auto h-7 w-7" />
        <p className="mt-2 text-sm">If <strong>{email}</strong> is a partner, we&apos;ve emailed a link to your dashboard. Check your inbox — and your <strong>spam/junk</strong> folder.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-2 flex items-center gap-2"><Mail className="h-5 w-5 text-primary" /><h2 className="font-bold">Access your dashboard</h2></div>
      <p className="mb-4 text-sm text-muted-foreground">Enter the email you signed up with and we&apos;ll email you a private link.</p>
      <input
        value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@email.com"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      />
      <button onClick={submit} disabled={busy || !email.includes("@")}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-brand px-6 py-3 text-sm font-semibold text-white shadow-glow disabled:opacity-60">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Email me my link
      </button>
    </div>
  );
}

export function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  };
  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 truncate rounded-lg border border-border bg-background px-3 py-2 text-sm">{link}</code>
      <button onClick={copy} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted">
        {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

// Partner sets where they want to be paid (manual Phase-1 payouts).
export function PortalPayoutForm({ token, initial }: { token: string; initial: { method: string; email: string; details: string } }) {
  const [method, setMethod] = useState(initial.method || "paypal");
  const [email, setEmail] = useState(initial.email || "");
  const [details, setDetails] = useState(initial.details || "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setBusy(true); setSaved(false); setError("");
    try {
      const r = await fetch("/api/enterprise/partner/portal/payout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, payout_method: method, payout_email: email, payout_details: details }),
      });
      if (!r.ok) { setError((await r.json().catch(() => ({}))).error ?? "Could not save."); return; }
      setSaved(true);
    } finally { setBusy(false); }
  };

  const input = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary";

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Payout method</label>
          <select value={method} onChange={(e) => setMethod(e.target.value)} className={input}>
            <option value="paypal">PayPal</option>
            <option value="wise">Wise</option>
            <option value="bank">Bank transfer</option>
            <option value="manual">Other</option>
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">{method === "paypal" || method === "wise" ? "Account email" : "Payout email"}</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@email.com" className={input} />
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium">Bank / extra details <span className="text-muted-foreground">(optional)</span></label>
        <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={2} placeholder="IBAN / routing / notes" className={input} />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <button onClick={save} disabled={busy}
        className="inline-flex items-center gap-2 rounded-lg bg-gradient-brand px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
        {saved ? "Saved" : "Save payout details"}
      </button>
    </div>
  );
}
