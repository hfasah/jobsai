import Link from "next/link";
import { headers } from "next/headers";
import { Handshake, Sparkles, AlertTriangle } from "lucide-react";
import { PublicEnterpriseHeader } from "@/components/enterprise/public-header";
import { PublicEnterpriseFooter } from "@/components/enterprise/public-footer";
import { getPartnerByPortalToken, getPartnerStats } from "@/lib/partner-program";
import { PARTNER_MIN_PAYOUT } from "@/lib/enterprise-partners";
import { CopyLink, PortalPayoutForm, RequestLinkForm, PortalActions } from "../portal-client";

export const metadata = {
  title: "Partner Dashboard — JobsAI Enterprise",
  description: "Track your referrals, earnings, and payouts.",
};

const usd = (c: number) => `$${(c / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function PartnerPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const partner = await getPartnerByPortalToken(token);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicEnterpriseHeader partnerMode />
      <div className="mx-auto max-w-4xl px-6 py-12">
        {!partner || partner.status === "suspended" ? (
          <div className="mx-auto max-w-md">
            <div className="mb-6 rounded-2xl border border-border bg-card p-6 text-center">
              <AlertTriangle className="mx-auto h-7 w-7 text-muted-foreground" />
              <h2 className="mt-3 text-lg font-bold">{partner ? "Account suspended" : "Link not valid"}</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {partner ? "Your partner account is suspended — contact us if this is a mistake." : "This dashboard link is invalid or expired. Request a fresh one below."}
              </p>
            </div>
            {!partner && <RequestLinkForm />}
          </div>
        ) : (
          <PortalView token={token} partner={partner} />
        )}
      </div>
      <PublicEnterpriseFooter />
    </main>
  );
}

async function PortalView({
  token,
  partner,
}: {
  token: string;
  partner: NonNullable<Awaited<ReturnType<typeof getPartnerByPortalToken>>>;
}) {
  const stats = await getPartnerStats(partner.id);
  const h = await headers();
  const host = h.get("host") ?? "app.jobsai.work";
  const proto = host.includes("localhost") ? "http" : "https";
  const referralLink = `${proto}://${host}/partner/${partner.referral_code}`;

  const cards: { label: string; value: string; hl?: boolean }[] = [
    { label: "Customers referred", value: String(stats.referrals) },
    { label: "Paying customers", value: String(stats.payingCustomers) },
    { label: "Lifetime earned", value: usd(stats.lifetimeEarnedCents) },
    { label: "Available balance", value: usd(stats.availableCents), hl: true },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-brand"><Handshake className="h-6 w-6 text-white" /></div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{partner.name || partner.company_name || "Partner"}&apos;s dashboard</h1>
            <p className="text-sm text-muted-foreground">Track referrals, earnings, and payouts.</p>
          </div>
        </div>
        {partner.email && <PortalActions token={token} email={partner.email} />}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
          {partner.is_founding && <Sparkles className="h-3.5 w-3.5" />}
          {partner.commission_rate}% commission{partner.is_founding ? " · Founding Partner" : ""}
        </span>
        <span className="rounded-full border border-border px-3 py-1 text-sm text-muted-foreground capitalize">{partner.tier} tier</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className={`rounded-2xl border bg-card p-5 ${c.hl ? "border-primary/40" : "border-border"}`}>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{c.label}</p>
            <p className={`mt-1 text-2xl font-bold ${c.hl ? "text-primary" : ""}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-semibold">Your referral link</h2>
        <p className="mt-1 mb-3 text-sm text-muted-foreground">Share this anywhere. Signups within 90 days are credited to you.</p>
        <CopyLink link={referralLink} />
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-semibold">Payout details</h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          We pay out monthly once your cleared balance passes {PARTNER_MIN_PAYOUT}. Pending (in hold): <strong>{usd(stats.pendingCents)}</strong> · Paid out: <strong>{usd(stats.paidCents)}</strong>.
        </p>
        <PortalPayoutForm
          token={token}
          initial={{ method: partner.payout_method ?? "", email: partner.payout_email ?? "", details: partner.payout_details ?? "" }}
        />
      </div>

      <div className="rounded-2xl border border-border bg-muted/30 p-5 text-sm text-muted-foreground">
        <p className="font-semibold text-foreground">How sign-in works</p>
        <p className="mt-1">
          There&apos;s no password — this private link <em>is</em> your sign-in. Bookmark it to come straight back, or use <strong>Email me this link</strong> above to send it to yourself.
        </p>
        <p className="mt-1">
          Lost it? Go to <Link href="/enterprise/partners/portal" className="text-primary hover:underline">the dashboard sign-in page</Link> and enter your email to get a fresh link. <strong>Sign out</strong> disables this link (use it on shared computers) — request a fresh one by email to return.
        </p>
      </div>
    </div>
  );
}
