import Link from "next/link";
import { Handshake, Check } from "lucide-react";
import { PublicEnterpriseHeader } from "@/components/enterprise/public-header";
import { PublicEnterpriseFooter } from "@/components/enterprise/public-footer";
import { PARTNER_BASE_RATE, PARTNER_COMMISSION_MONTHS, FOUNDING_PARTNER_RATE, FOUNDING_PARTNER_LIMIT } from "@/lib/enterprise-partners";
import { PartnerApplyForm } from "./apply-form";

export const metadata = {
  title: "Become a Partner — JobsAI Enterprise",
  description: "Create your JobsAI referral link in minutes and earn recurring cash commission for every customer you refer — no login or purchase required to start.",
};

const PERKS = [
  "No JobsAI account or purchase required",
  `${PARTNER_BASE_RATE}–30% recurring cash for ${PARTNER_COMMISSION_MONTHS} months`,
  "Your own referral link in minutes",
  "Track referrals & earnings in your dashboard",
];

export default function PartnerApplyPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicEnterpriseHeader />
      <section className="mx-auto max-w-2xl px-6 py-12">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-brand"><Handshake className="h-6 w-6 text-white" /></div>
          <h1 className="text-3xl font-bold tracking-tight">Create your partner link</h1>
          <p className="mx-auto mt-2 max-w-lg text-muted-foreground">
            Fill the short form, verify your email, and get a referral link to share. The first {FOUNDING_PARTNER_LIMIT} partners lock {FOUNDING_PARTNER_RATE}% for {PARTNER_COMMISSION_MONTHS} months.
          </p>
        </div>

        <ul className="mx-auto mb-6 grid max-w-lg gap-2 sm:grid-cols-2">
          {PERKS.map((p) => (
            <li key={p} className="flex items-start gap-2 text-sm"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />{p}</li>
          ))}
        </ul>

        <PartnerApplyForm />

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Curious how it works? Read the <Link href="/enterprise/partners" className="text-primary hover:underline">Partner Program</Link> overview.
        </p>
      </section>
      <PublicEnterpriseFooter />
    </main>
  );
}
