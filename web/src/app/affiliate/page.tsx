"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import {
  Loader2, Gift, Copy, Check, MousePointerClick, UserPlus, TrendingUp, Sparkles, ExternalLink,
} from "lucide-react";

interface Affiliate {
  id: string; code: string; name: string; discount_pct: number; commission_pct: number;
  clicks: number; signups: number; conversions: number;
}
interface Referral { event: string; plan: string | null; created_at: string }

export default function AffiliatePage() {
  const { isSignedIn, user } = useUser();
  const [aff, setAff] = useState<Affiliate | null>(null);
  const [recent, setRecent] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [joining, setJoining] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isSignedIn) { setLoading(false); return; }
    fetch("/api/affiliates").then((r) => r.json()).then((j) => {
      if (j.data) { setAff(j.data.affiliate); setRecent(j.data.recent ?? []); }
    }).finally(() => setLoading(false));
  }, [isSignedIn]);

  useEffect(() => { if (user?.fullName) setName(user.fullName); }, [user]);

  const join = async () => {
    if (!name.trim()) return;
    setJoining(true);
    const res = await fetch("/api/affiliates", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email: user?.primaryEmailAddress?.emailAddress }),
    });
    const json = await res.json();
    if (json.data) setAff(json.data);
    setJoining(false);
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "https://jobsai.work";
  const link = aff ? `${origin}/?ref=${aff.code}` : "";

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <header className="border-b border-white/10 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/" className="text-lg font-bold"><span className="text-gradient">JobsAI</span></Link>
          <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">Dashboard →</Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-brand shadow-glow">
            <Gift className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Affiliate Program</h1>
          <p className="mx-auto mt-2 max-w-lg text-muted-foreground">
            Share JobsAI and give businesses <strong className="text-foreground">15% off</strong> their subscription.
            Earn commission on every customer you refer.
          </p>
        </div>

        {loading ? (
          <div className="mt-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : !isSignedIn ? (
          <div className="mt-10 rounded-2xl border border-border bg-card p-8 text-center">
            <p className="text-muted-foreground">Sign in to join the affiliate program and get your link.</p>
            <Link href="/sign-in?redirect_url=/affiliate" className="btn-cta mt-4 inline-flex rounded-xl px-6 py-2.5 text-sm font-semibold">Sign in</Link>
          </div>
        ) : !aff ? (
          <div className="mx-auto mt-10 max-w-md rounded-2xl border border-border bg-card p-6">
            <h2 className="font-semibold">Become an affiliate</h2>
            <p className="mt-1 text-sm text-muted-foreground">Get a unique referral link in seconds.</p>
            <label className="mt-4 block text-sm font-medium">Your name or brand</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith"
              className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            <button onClick={join} disabled={joining || !name.trim()}
              className="btn-cta mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold disabled:opacity-60">
              {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Create my affiliate link
            </button>
          </div>
        ) : (
          <div className="mt-10 space-y-6">
            {/* Link */}
            <div className="rounded-2xl border border-border bg-card p-6">
              <p className="text-sm font-medium">Your referral link</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Anyone who subscribes through this link gets {aff.discount_pct}% off.</p>
              <div className="mt-3 flex items-center gap-2">
                <code className="flex-1 overflow-x-auto rounded-lg border border-border bg-background px-3 py-2 text-sm">{link}</code>
                <button onClick={() => { navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                  className="btn-cta inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { label: "Clicks", value: aff.clicks, icon: MousePointerClick, color: "text-blue-400" },
                { label: "Sign-ups", value: aff.signups, icon: UserPlus, color: "text-purple-400" },
                { label: "Conversions", value: aff.conversions, icon: TrendingUp, color: "text-green-400" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="rounded-2xl border border-border bg-card p-5">
                  <div className="flex items-center gap-2 text-muted-foreground"><Icon className={`h-4 w-4 ${color}`} /><span className="text-xs">{label}</span></div>
                  <p className="mt-1.5 text-3xl font-bold tabular-nums">{value}</p>
                </div>
              ))}
            </div>

            {/* Recent activity */}
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="border-b border-border px-5 py-3.5"><h2 className="font-semibold">Recent activity</h2></div>
              {recent.length === 0 ? (
                <p className="px-5 py-6 text-sm text-muted-foreground">No activity yet. Share your link to get started.</p>
              ) : (
                <div className="divide-y divide-border">
                  {recent.map((r, i) => (
                    <div key={i} className="flex items-center justify-between px-5 py-2.5 text-sm">
                      <span className="capitalize">
                        {r.event === "conversion" ? <span className="text-green-400">Conversion{r.plan ? ` · ${r.plan}` : ""}</span>
                          : r.event === "signup" ? <span className="text-purple-400">Sign-up</span>
                          : <span className="text-muted-foreground">Click</span>}
                      </span>
                      <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <p className="text-center text-xs text-muted-foreground">
              Enterprise referrals? <Link href="/contact" className="text-primary hover:underline">Contact us</Link> to set up custom volume commissions.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
