import Link from "next/link";
import { Handshake } from "lucide-react";
import { PublicEnterpriseHeader } from "@/components/enterprise/public-header";
import { PublicEnterpriseFooter } from "@/components/enterprise/public-footer";
import { RequestLinkForm } from "./portal-client";

export const metadata = {
  title: "Partner Dashboard — JobsAI Enterprise",
  description: "Access your partner dashboard.",
};

export default async function PartnerPortalRequestPage({ searchParams }: { searchParams: Promise<{ signedout?: string }> }) {
  const { signedout } = await searchParams;
  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicEnterpriseHeader partnerMode />
      <section className="mx-auto max-w-md px-6 py-16">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-brand"><Handshake className="h-6 w-6 text-white" /></div>
          <h1 className="text-2xl font-bold tracking-tight">Partner dashboard</h1>
          <p className="mt-2 text-sm text-muted-foreground">No login needed — we&apos;ll email you a private link.</p>
        </div>
        {signedout && (
          <div className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-center text-sm text-emerald-800">
            You&apos;re signed out and the old link is now disabled. Enter your email to get a fresh one.
          </div>
        )}
        <RequestLinkForm />
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Not a partner yet? <Link href="/enterprise/partners/apply" className="text-primary hover:underline">Create your referral link</Link>
        </p>
      </section>
      <PublicEnterpriseFooter />
    </main>
  );
}
