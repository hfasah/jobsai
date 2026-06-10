"use client";

import { useEffect, useState } from "react";
import { Copy, Check, Users, TrendingUp, Gift, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ReferralStats {
  referral_code: string;
  total_referrals: number;
  converted_referrals: number;
  total_tokens_earned: number;
}

export default function ReferralsPage() {
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/referrals/stats");
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (err) {
        console.error("Failed to fetch referral stats:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const handleCopyLink = () => {
    if (stats?.referral_code) {
      const referralLink = `${window.location.origin}/join?ref=${stats.referral_code}`;
      navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const conversionRate =
    stats && stats.total_referrals > 0
      ? Math.round((stats.converted_referrals / stats.total_referrals) * 100)
      : 0;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading referral stats...</div>
      </div>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Referral Program</h1>
        <p className="text-muted-foreground">
          Invite friends, earn tokens. When they buy a plan, you both get rewarded.
        </p>
      </div>

      {/* Referral Link Card */}
      {stats && (
        <div className="mb-8 rounded-xl border border-border bg-gradient-to-br from-primary/10 to-transparent p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h2 className="text-lg font-semibold mb-2">Your Referral Link</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Share this link to invite friends. When they buy a plan, you both earn tokens.
              </p>
              <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2.5 font-mono text-sm">
                <code className="flex-1 break-all">
                  {window.location.origin}/join?ref={stats.referral_code}
                </code>
                <button
                  onClick={handleCopyLink}
                  className="flex-shrink-0 rounded-md p-1 hover:bg-muted transition-colors"
                  title="Copy link"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Copy className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Total Referrals */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase text-muted-foreground">
              Total Referrals
            </span>
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold">{stats?.total_referrals ?? 0}</p>
          <p className="text-xs text-muted-foreground mt-1">people invited</p>
        </div>

        {/* Converted */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase text-muted-foreground">
              Converted
            </span>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-emerald-600">
            {stats?.converted_referrals ?? 0}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {conversionRate}% conversion rate
          </p>
        </div>

        {/* Tokens Earned */}
        <div className="rounded-lg border border-border bg-card p-4 md:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase text-muted-foreground">
              Total Tokens Earned
            </span>
            <Gift className="h-4 w-4 text-primary" />
          </div>
          <p className="text-2xl font-bold text-primary">
            {(stats?.total_tokens_earned ?? 0).toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground mt-1">from referrals</p>
        </div>
      </div>

      {/* How It Works */}
      <div className="rounded-lg border border-border bg-card p-6 mb-8">
        <h3 className="text-lg font-semibold mb-4">How It Works</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary font-semibold text-sm">
                1
              </div>
              <h4 className="font-medium">Share Your Link</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              Send your unique referral link to friends or share on social media.
            </p>
          </div>

          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary font-semibold text-sm">
                2
              </div>
              <h4 className="font-medium">They Sign Up & Buy</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              When they sign up via your link and purchase a plan, rewards unlock.
            </p>
          </div>

          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary font-semibold text-sm">
                3
              </div>
              <h4 className="font-medium">Earn Tokens</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              Both of you get tokens instantly. More tokens for Premium referrals!
            </p>
          </div>
        </div>
      </div>

      {/* Reward Breakdown */}
      <div className="rounded-lg border border-border bg-card p-6 mb-8">
        <h3 className="text-lg font-semibold mb-4">Reward Breakdown</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-border/50">
            <span className="text-sm">Base referral reward</span>
            <span className="font-semibold">1,000 tokens</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border/50">
            <span className="text-sm">Premium plan bonus</span>
            <span className="font-semibold text-primary">+500 tokens</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm">Referred user gets</span>
            <span className="font-semibold text-emerald-600">1,000 tokens</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          💡 Rewards are only awarded when someone buys a paid plan (Pro, Premium, or Career Accelerator).
        </p>
      </div>

      {/* Share CTA */}
      <div className="text-center py-6">
        <Button size="lg" className="gap-2">
          <Share2 className="h-5 w-5" />
          Share Your Referral Link
        </Button>
        <p className="text-xs text-muted-foreground mt-3">
          Already shared with {stats?.total_referrals ?? 0} people
        </p>
      </div>
    </main>
  );
}
