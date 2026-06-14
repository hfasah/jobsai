"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, ArrowRight, Mail, Copy, Check, Sparkles, ShieldCheck } from "lucide-react";
import { PARTNER_AUDIENCE_TYPES } from "@/lib/enterprise-partners";

const ESTIMATES = ["1–5 / year", "6–20 / year", "21–50 / year", "50+ / year"];

type Done = { link: string; portal_link: string | null; referral_code: string; commission_rate: number; is_founding: boolean };

export function PartnerApplyForm() {
  const [step, setStep] = useState<"form" | "verify" | "done">("form");
  const [form, setForm] = useState({
    name: "", email: "", company_name: "", linkedin: "", website: "", audience_type: "", estimated_referrals: "",
  });
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [done, setDone] = useState<Done | null>(null);
  const [copied, setCopied] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submitForm = async () => {
    setBusy(true); setError(""); setNotice("");
    try {
      const r = await fetch("/api/enterprise/partner/apply", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? "Something went wrong."); return; }
      if (j.alreadyVerified) { setError("This email is already a partner. Check your inbox for your link, or contact us."); return; }
      setStep("verify");
    } finally { setBusy(false); }
  };

  const verify = async () => {
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/enterprise/partner/verify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, code }),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? "Could not verify."); return; }
      setDone(j.data); setStep("done");
    } finally { setBusy(false); }
  };

  const resend = async () => {
    setBusy(true); setError(""); setNotice("");
    try {
      const r = await fetch("/api/enterprise/partner/apply", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      if (r.ok) setNotice("A new code is on its way."); else setError("Could not resend the code.");
    } finally { setBusy(false); }
  };

  const copy = async () => {
    if (!done) return;
    try { await navigator.clipboard.writeText(done.link); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  };

  const input = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary";

  if (step === "done" && done) {
    return (
      <div className="rounded-2xl border border-primary/30 bg-card p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-brand"><Check className="h-6 w-6 text-white" /></div>
        <h2 className="mt-3 text-xl font-bold">You&apos;re a partner! 🎉</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          You&apos;ll earn <strong>{done.commission_rate}%</strong>{done.is_founding ? " (Founding Partner rate)" : ""} on every customer you refer. Share your link:
        </p>
        <div className="mt-4 flex items-center gap-2">
          <code className="flex-1 truncate rounded-lg border border-border bg-background px-3 py-2 text-sm">{done.link}</code>
          <button onClick={copy} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted">
            {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Bookmark this link. Anyone who signs up within 90 days of clicking it is credited to you.
        </p>
        {done.portal_link && (
          <Link href={done.portal_link} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
            Open your private dashboard <ArrowRight className="h-4 w-4" />
          </Link>
        )}
        <p className="mt-3 text-xs text-muted-foreground">We also emailed you both links — check your spam folder if it&apos;s not in your inbox.</p>
      </div>
    );
  }

  if (step === "verify") {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-2 flex items-center gap-2"><Mail className="h-5 w-5 text-primary" /><h2 className="font-bold">Check your email</h2></div>
        <p className="mb-2 text-sm text-muted-foreground">We sent a 6-digit code to <strong>{form.email}</strong>. Enter it to activate your referral link.</p>
        <p className="mb-4 rounded-lg border border-amber-300/50 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          📩 Don&apos;t see it? Check your <strong>spam/junk</strong> folder and mark it <strong>“Not spam”</strong> — it&apos;s from <strong>support@send.jobsai.work</strong>.
        </p>
        <input
          value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric" placeholder="123456"
          className={`${input} text-center text-2xl tracking-[0.5em]`}
        />
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        {notice && <p className="mt-2 text-sm text-emerald-600">{notice}</p>}
        <button onClick={verify} disabled={busy || code.length < 6}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-brand px-6 py-3 text-sm font-semibold text-white shadow-glow disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Verify & get my link
        </button>
        <button onClick={resend} disabled={busy} className="mt-3 w-full text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-60">
          Didn&apos;t get it? Resend code
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Your name *</label>
          <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Sarah Lee" className={input} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Email *</label>
          <input value={form.email} onChange={(e) => set("email", e.target.value)} type="email" placeholder="sarah@email.com" className={input} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Company <span className="text-muted-foreground">(optional)</span></label>
          <input value={form.company_name} onChange={(e) => set("company_name", e.target.value)} placeholder="Acme Advisory" className={input} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">LinkedIn / website <span className="text-muted-foreground">(optional)</span></label>
          <input value={form.linkedin} onChange={(e) => set("linkedin", e.target.value)} placeholder="linkedin.com/in/…" className={input} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium">What best describes you?</label>
          <select value={form.audience_type} onChange={(e) => set("audience_type", e.target.value)} className={input}>
            <option value="">Select…</option>
            {PARTNER_AUDIENCE_TYPES.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Estimated referrals / year</label>
          <select value={form.estimated_referrals} onChange={(e) => set("estimated_referrals", e.target.value)} className={input}>
            <option value="">Select…</option>
            {ESTIMATES.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <button onClick={submitForm} disabled={busy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-brand px-6 py-3 text-sm font-semibold text-white shadow-glow disabled:opacity-60">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} Create my referral link
      </button>
      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5" /> We&apos;ll email a code to verify it&apos;s really you — no spam.
      </p>
      <p className="text-center text-xs text-muted-foreground">
        Already a partner? <Link href="/enterprise/partners/portal" className="text-primary hover:underline">Open your dashboard</Link>
      </p>
    </div>
  );
}
