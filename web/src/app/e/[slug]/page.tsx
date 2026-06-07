import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { getMyMembership } from "@/lib/enterprise";
import { supabaseAdmin } from "@/lib/supabase";

// Custom per-enterprise home page: /e/{company-slug}
// - Signed-in members go straight to their workspace.
// - Everyone else (incl. after logout) sees the company's branded landing with a
//   request to log in. Intentionally minimal — no JobsAI marketing content.
export default async function EnterpriseHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { userId } = await auth();
  if (userId) {
    const membership = await getMyMembership(userId);
    if (membership) redirect("/enterprise/dashboard");
  }

  const { data: org } = await supabaseAdmin
    .from("enterprise_orgs")
    .select("name, logo_url, brand_color")
    .eq("slug", slug)
    .maybeSingle();

  // portal_title fetched separately + best-effort so a pre-migration deployment
  // still renders the page (falls back to the default heading).
  const { data: pt } = await supabaseAdmin
    .from("enterprise_orgs")
    .select("portal_title")
    .eq("slug", slug)
    .maybeSingle();

  const brand = org?.brand_color || "#2563eb";
  const heading = (pt as { portal_title?: string } | null)?.portal_title
    || (org?.name ? `${org.name} HR Management & Recruitment Portal` : "HR Management & Recruitment Portal");
  const loginHref = `/enterprise-login?redirect_url=${encodeURIComponent(`/e/${slug}`)}`;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <div className="flex flex-1 flex-col items-center justify-center">
        {org?.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={org.logo_url} alt={org.name} className="mb-6 h-16 max-w-[220px] object-contain" />
        ) : (
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: brand }}>
            <Building2 className="h-8 w-8 text-white" />
          </div>
        )}

        <h1 className="max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl" style={{ color: brand }}>
          {heading}
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">Welcome. Please sign in to access your recruitment workspace.</p>

        <Link
          href={loginHref}
          className="mt-8 inline-flex h-12 items-center justify-center rounded-xl px-10 text-base font-semibold text-white shadow-lg transition-opacity hover:opacity-90"
          style={{ background: brand }}
        >
          Log in
        </Link>
      </div>

      <footer className="pb-8 pt-12 text-xs text-muted-foreground">
        Powered by{" "}
        <a href="https://www.jobsai.work" className="font-medium hover:underline" target="_blank" rel="noopener noreferrer">
          JobsAI.Work
        </a>
      </footer>
    </main>
  );
}
