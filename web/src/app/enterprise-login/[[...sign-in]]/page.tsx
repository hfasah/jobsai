import { SignIn } from "@clerk/nextjs";
import Image from "next/image";
import { Building2, Users, BarChart3, ShieldCheck, CalendarDays, Globe } from "lucide-react";
import { enterpriseAppearance } from "@/lib/clerk-appearance";
import { supabaseAdmin } from "@/lib/supabase";

const FEATURES = [
  { icon: Users,        label: "AI-screened candidates, ranked into pools" },
  { icon: BarChart3,    label: "Pipeline analytics, time-to-hire & source quality" },
  { icon: CalendarDays, label: "Interview scheduling with calendar invites" },
  { icon: Globe,        label: "Post once, syndicate to every job board" },
  { icon: ShieldCheck,  label: "References, background checks & compliance" },
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
  if (slug) {
    const { data } = await supabaseAdmin
      .from("enterprise_orgs").select("name, logo_url, brand_color").eq("slug", slug).maybeSingle();
    org = data;
  }
  const brand = org?.brand_color || "#2563eb";

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
              <h2 className="text-lg font-bold" style={{ color: brand }}>The {org.name} HR Management Portal</h2>
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
          <h1 className="text-2xl font-bold text-foreground">Recruiter sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">Use the work email your invite was sent to. Enterprise accounts use email sign-in only.</p>
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

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Looking for the job-seeker app? <a href="/sign-in" className="font-medium text-primary hover:underline">Sign in here</a>
        </p>
      </div>

      {/* Right: branded marketing */}
      <div className="relative hidden flex-1 overflow-hidden lg:flex lg:flex-col lg:justify-center lg:px-16" style={{ background: `linear-gradient(135deg, ${brand}, ${brand}cc)` }}>
        <div className="pointer-events-none absolute -right-24 top-1/3 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="relative max-w-lg text-white">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
            <Building2 className="h-7 w-7" />
          </div>
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
