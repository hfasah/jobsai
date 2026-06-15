import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { Handshake, Sparkles, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { PublicEnterpriseHeader } from "@/components/enterprise/public-header";
import { PublicEnterpriseFooter } from "@/components/enterprise/public-footer";
import { getPartnerByUser, getPartnerStats } from "@/lib/partner-program";
import { getConnectStatus } from "@/lib/partner-connect";
import { PARTNER_MIN_PAYOUT, PARTNER_COMMISSION_MONTHS } from "@/lib/enterprise-partners";
import { JoinForm, CopyLink, ConnectButton } from "./dashboard-client";

export const metadata = {
  title: "Partner Dashboard — JobsAI Enterprise",
  description: "Track your referrals, earnings, and payouts.",
};

function usd(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function PartnerDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ connect?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/enterprise-login?redirect_url=/enterprise/partners/dashboard");

  const partner = await getPartnerByUser(userId);
  const { connect } = await searchParams;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicEnterpriseHeader />
      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-brand"><Handshake className="h-6 w-6 text-white" /></div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Partner Dashboard</h1>
            <p className="text-sm text-muted-foreground">Track referrals, earnings, and payouts.</p>
          </div>
        </div>

        {!partner ? (
          <div className="mx-auto max-w-md">
            <div className="mb-6 text-center">
              <p className="text-sm text-muted-foreground">
                Apply to the Partner Program to get a referral link and start earning {" "}
                <strong>cash</strong> commission for {PARTNER_COMMISSION_MONTHS} months on every customer you refer.
              </p>
            </div>
            <JoinForm />
            <p className="mt-4 text-center text-xs text-muted-foreground">
              By applying you agree to the <Link href="/enterprise/guide/partner-terms" className="text-primary hover:underline">Partner Program terms</Link>. We review applications before activating your link.
            </p>
          </div>
        ) : partner.status === "pending" ? (
          <div className="mx-auto max-w-md rounded-2xl border border-amber-300 bg-amber-50 p-6 text-center">
            <Clock className="mx-auto h-7 w-7 text-amber-600" />
            <h2 className="mt-3 text-lg font-bold text-amber-900">Application under review</h2>
            <p className="mt-2 text-sm text-amber-800">
              Thanks for applying! We&apos;re reviewing your application and will email you when your referral link is live.
              You&apos;ll earn <strong>{partner.commission_rate}%</strong>{partner.is_founding ? " (Founding Partner rate)" : ""} once approved.
            </p>
          </div>
        ) : partner.status === "suspended" ? (
          <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-6 text-center">
            <AlertTriangle className="mx-auto h-7 w-7 text-muted-foreground" />
            <h2 className="mt-3 text-lg font-bold">Account suspended</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your partner account is currently suspended. <Link href="/enterprise/contact" className="text-primary hover:underline">Contact us</Link> if you think this is a mistake.
            </p>
          </div>
        ) : (
          <PartnerView partner={partner} connectFlag={connect} />
        )}
      </div>
      <PublicEnterpriseFooter />
    </main>
  );
}

async function PartnerView({
  partner,
  connectFlag,
}: {
  partner: NonNullable<Awaited<ReturnType<typeof getPartnerByUser>>>;
  connectFlag?: string;
}) {
  const stats = await getPartnerStats(partner.id);
  const h = await headers();
  const host = h.get("host") ?? "app.jobsai.work";
  const proto = host.includes("localhost") ? "http" : "https";
  const referralLink = `${proto}://${host}/partner/${partner.referral_code}`;

  const connect = partner.stripe_connect_id
    ? await getConnectStatus(partner.stripe_connect_id)
    : { payoutsEnabled: false, detailsSubmitted: false };

  const cards: { label: string; value: string; hl?: boolean }[] = [
    { label: "Customers referred", value: String(stats.referrals) },
    { label: "Paying customers", value: String(stats.payingCustomers) },
    { label: "Lifetime earned", value: usd(stats.lifetimeEarnedCents) },
    { label: "Available balance", value: usd(stats.availableCents), hl: true },
  ];

  return (
    <div className="space-y-6">
      {connectFlag === "done" && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4" /> Payout details received. Stripe may take a moment to verify your account.
        </div>
      )}

      {/* Status row */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
          {partner.is_founding && <Sparkles className="h-3.5 w-3.5" />}
          {partner.commission_rate}% commission{partner.is_founding ? " · Founding Partner" : ""}
        </span>
        <span className="rounded-full border border-border px-3 py-1 text-sm text-muted-foreground capitalize">{partner.tier} tier</span>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className={`rounded-2xl border bg-card p-5 ${c.hl ? "border-primary/40" : "border-border"}`}>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{c.label}</p>
            <p className={`mt-1 text-2xl font-bold ${c.hl ? "text-primary" : ""}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Referral link */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-semibold">Your referral link</h2>
        <p className="mt-1 mb-3 text-sm text-muted-foreground">Share this anywhere. Signups within 90 days are credited to you.</p>
        <CopyLink link={referralLink} />
      </div>

      {/* Payouts */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-semibold">Payouts</h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          Commissions accrue as your customers pay, clear after a hold, and pay out monthly once your balance passes {PARTNER_MIN_PAYOUT}. Pending (in hold): <strong>{usd(stats.pendingCents)}</strong> · Paid out: <strong>{usd(stats.paidCents)}</strong>.
        </p>
        {connect.payoutsEnabled ? (
          <div className="mb-4 flex items-center gap-2 text-sm text-emerald-600">
            <CheckCircle2 className="h-4 w-4" /> Payouts connected via Stripe.
          </div>
        ) : partner.stripe_connect_id ? (
          <div className="mb-4 flex items-center gap-2 text-sm text-amber-600">
            <AlertTriangle className="h-4 w-4" /> Payout setup incomplete — finish onboarding to receive cash.
          </div>
        ) : (
          <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4" /> Connect a bank account to receive payouts.
          </div>
        )}
        <ConnectButton connected={!!partner.stripe_connect_id} />
      </div>
    </div>
  );
}
