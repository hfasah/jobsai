import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { ArrowLeft } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyMembership, orgHasAccess } from "@/lib/enterprise";
import { getOrgEntitlements } from "@/lib/enterprise-entitlements";
import { PlanGrid } from "./plan-grid";
import { PlanComparison } from "@/components/enterprise/plan-comparison";

export const dynamic = "force-dynamic";

export default async function EnterprisePlansPage() {
  const { data } = await supabaseAdmin
    .from("plans")
    .select("slug,name,price_monthly,price_yearly,sort_order")
    .eq("active", true)
    .order("sort_order");
  const plans = (data ?? []) as { slug: string; name: string; price_monthly: number | null; price_yearly: number | null }[];

  // Back link: existing active members came from Billing → back to dashboard;
  // everyone else (onboarding) → back to the marketing home.
  const { userId } = await auth();
  let backHref = "/enterprise/home";
  let backLabel = "Back to home";
  if (userId) {
    const member = await getMyMembership(userId);
    if (member) {
      const ent = await getOrgEntitlements(member.org_id);
      if (orgHasAccess(ent.accessStatus)) { backHref = "/enterprise/dashboard"; backLabel = "Back to dashboard"; }
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-14">
      <Link href={backHref} className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {backLabel}
      </Link>
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Choose your plan</h1>
        <p className="mt-2 text-muted-foreground">14-day free trial. Cancel anytime.</p>
      </div>

      <PlanGrid plans={plans} />

      <div className="mt-14">
        <h2 className="mb-6 text-center text-2xl font-bold">Compare every plan</h2>
        <PlanComparison />
      </div>
    </main>
  );
}
