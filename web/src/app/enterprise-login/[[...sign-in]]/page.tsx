import { SignIn } from "@clerk/nextjs";
import Image from "next/image";
import { Building2, Bot, Mic, Users, CalendarDays, FileSignature, ShieldCheck } from "lucide-react";
import { enterpriseAppearance } from "@/lib/clerk-appearance";
import { supabaseAdmin } from "@/lib/supabase";

const FEATURES = [
  { icon: Bot,           label: "Autonomous AI sourcing & outreach agent" },
  { icon: Mic,           label: "AI voice screening, auto-scored & ranked" },
  { icon: Users,         label: "Kanban pipeline with candidate pools" },
  { icon: CalendarDays,  label: "Interview scheduling with calendar invites" },
  { icon: FileSignature, label: "Offer letters with built-in e-signature" },
  { icon: ShieldCheck,   label: "SSO, white-label, audit logs & compliance" },
];

export default async function EnterpriseLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  const sp = await searchParams;

  // White-label: if arriving via a company's /e/{slug} link, resolve the org
  const slug = (sp.redirect_url ?? "").match(/\/e\/([a-z0-9-]+)/i)?.[1];
  let org: { name: string; logo_url: string | null; brand_color: string | null } | null = null;
  let portalTitle: string | null = null;
  if (slug) {
    const { data } = await supabaseAdmin
      .from("enterprise_orgs").select("name, logo_url, brand_color").eq("slug", slug).maybeSingle();
    org = data;
    // best-effort (column may not exist pre-migration 045)
    const { data: pt } = await supabaseAdmin
      .from("enterprise_orgs").select("portal_title").eq("slug", slug).maybeSingle();
    portalTitle = (pt as { portal_title?: string } | null)?.portal_title ?? null;
  }
  const brand = org?.brand_color || "#2563eb";
  const portalHeading = portalTitle || (org ? `The ${org.name} HR Management Portal` : "");

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Left: email-only sign-in */}
      <div className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-12 lg:max-w-[520px]">
        {/* White-label header */}
        <div className="mb-8 w-full max-w-sm text-center">
          {org?.logo_url ? (
            <img src={org.logo_url} alt={org.name} className="mx-auto mb-3 h-12 object-contain" />
          ) : (
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: brand }}>
              <Building2 className="h-6 w-6 text-white" />
            </div>
          )}
          {org ? (
            <>
              <h2 className="text-lg font-bold" style={{ color: brand }}>{portalHeading}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Powered by <a href="https://www.jobsai.work" className="hover:underline">JobsAI.Work</a> · www.jobsAI.Work
              </p>
            </>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <Image src="/logo.png" alt="JobsAI" width={32} height={32} className="rounded-lg" />
              <span className="text-lg font-bold text-gradient">JobsAI</span>
              <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">Enterprise</span>
            </div>
          )}
        </div>

        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold text-foreground">{org ? `Sign in to ${org.name}` : "Sign in to JobsAI Enterprise"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create an account or sign in with your work email to start your recruiting workspace.</p>
          <div className="mt-6">
            <SignIn
              appearance={enterpriseAppearance}
              forceRedirectUrl="/launch"
              signUpUrl="/enterprise-login"
              routing="path"
              path="/enterprise-login"
            />
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center gap-2 text-center text-xs text-muted-foreground">
          <p>
            New here? <a href="/enterprise/pricing" className="font-medium text-primary hover:underline">View plans &amp; pricing</a>
            {" · "}
            <a href="https://api.leadconnectorhq.com/widget/booking/5HFMVFvz8AJQ4gjY7B9F" target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">Book a demo</a>
          </p>
          <p>Looking for the job-seeker app? <a href="/sign-in" className="font-medium text-primary hover:underline">Sign in here</a></p>
        </div>
      </div>

      {/* Right: branded marketing */}
      <div className="relative hidden flex-1 overflow-hidden lg:flex lg:flex-col lg:justify-center lg:px-16" style={{ background: `linear-gradient(135deg, ${brand}, ${brand}cc)` }}>
        <div className="pointer-events-none absolute -right-24 top-1/3 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="relative max-w-lg text-white">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
            <Building2 className="h-7 w-7" />
          </div>
          <p className="mb-3 text-base font-bold tracking-wide text-white">AI-Powered Talent Acquisition Operating System</p>
          <h2 className="text-4xl font-bold leading-tight">
            {org ? `${org.name}'s` : "Your AI"} recruiting<br />command center.
          </h2>
          <p className="mt-3 text-lg text-white/80">Attract, screen, interview, and hire top talent at scale — in one workspace.</p>
          <ul className="mt-8 space-y-3">
            {FEATURES.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15"><Icon className="h-4 w-4" /></span>
                <span className="text-white/90">{label}</span>
              </li>
            ))}
          </ul>
          {org && <p className="mt-10 text-xs text-white/50">Powered by JobsAI.Work · www.jobsAI.Work</p>}
        </div>
      </div>
    </div>
  );
}
