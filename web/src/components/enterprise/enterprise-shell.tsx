"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, SignOutButton } from "@clerk/nextjs";
import {
  LayoutGrid, Briefcase, Users, BarChart3, Settings, Inbox, FileSpreadsheet, UsersRound, Globe, CalendarDays,
  Menu, X, Building2, ChevronRight, Sparkles, LogOut, FileText, Zap, Bot, ClipboardCheck, Shield, CreditCard, Package, Plug,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { EnterpriseOrg } from "@/types/enterprise";
import { AskAI } from "@/components/enterprise/ask-ai";
import { NudgeBanner } from "@/components/enterprise/nudge-banner";

// `feature` (when set) hides the item unless the org's plan entitles it.
const NAV: { href: string; icon: typeof LayoutGrid; label: string; feature?: string }[] = [
  { href: "/enterprise/dashboard",        icon: LayoutGrid,       label: "Dashboard" },
  { href: "/enterprise/hiring-manager",   icon: ClipboardCheck,   label: "My Workspace", feature: "hiring_manager_workspace" },
  { href: "/enterprise/inbox",            icon: Inbox,            label: "Inbox" },
  { href: "/enterprise/jobs",      icon: Briefcase,        label: "Jobs" },
  { href: "/enterprise/boards",    icon: Globe,            label: "Job Boards" },
  { href: "/enterprise/candidates",icon: Users,            label: "Candidates" },
  { href: "/enterprise/sourcing",  icon: Sparkles,         label: "Sourcing", feature: "ai_sourcing" },
  { href: "/enterprise/schedule",  icon: CalendarDays,     label: "Schedule" },
  { href: "/enterprise/offers",    icon: FileText,         label: "Offers" },
  { href: "/enterprise/copilot",   icon: Bot,              label: "AI Copilot" },
  { href: "/enterprise/agent",     icon: Bot,              label: "Agent", feature: "recruiting_agent" },
  { href: "/enterprise/workflows", icon: Zap,              label: "Workflows", feature: "workflow_automation" },
  { href: "/enterprise/analytics", icon: BarChart3,        label: "Analytics", feature: "executive_analytics" },
  { href: "/enterprise/reports",   icon: FileSpreadsheet,  label: "Reports", feature: "client_reporting" },
  { href: "/enterprise/compliance", icon: Shield,           label: "Compliance", feature: "compliance_gdpr" },
  { href: "/enterprise/ats",       icon: Plug,             label: "ATS Integration", feature: "ats_integration" },
  { href: "/enterprise/team",      icon: UsersRound,       label: "Team & Access" },
  { href: "/enterprise/addons",    icon: Package,          label: "Add-ons" },
  { href: "/enterprise/billing",   icon: CreditCard,       label: "Billing" },
  { href: "/enterprise/settings",  icon: Settings,         label: "Settings" },
];

interface Ent { planName: string | null; accessStatus: string | null; trialEndsAt: string | null; features: string[] }

function Sidebar({ org, ent, onNavigate }: { org: EnterpriseOrg | null; ent: Ent | null; onNavigate?: () => void }) {
  const pathname = usePathname();
  // ent === null => entitlements not loaded yet, show everything optimistically.
  const features = ent?.features ?? null;
  const nav = NAV.filter((item) => !item.feature || features === null || features.includes(item.feature));
  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-14 items-center gap-3 border-b border-border px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-brand">
          <Building2 className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-foreground">
            {org?.name ?? "Enterprise"}
          </p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Recruiting</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {nav.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link key={href} href={href} onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-gradient-brand text-white shadow-glow" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}>
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-3 space-y-2">
        {ent?.planName && (
          <Link href="/enterprise/billing" onClick={onNavigate} className="block rounded-lg border border-border bg-muted/40 px-3 py-2 hover:bg-muted">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-xs font-semibold text-foreground">{ent.planName}</span>
              <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold capitalize text-primary">{ent.accessStatus ?? "—"}</span>
            </div>
            {ent.accessStatus === "trialing" && ent.trialEndsAt && (
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                Trial ends {new Date(ent.trialEndsAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · Upgrade →
              </p>
            )}
          </Link>
        )}
        <div className="flex items-center gap-2 px-1">
          <UserButton appearance={{ elements: { avatarBox: "h-8 w-8" } }} />
          <SignOutButton redirectUrl={org?.slug ? `/e/${org.slug}` : "/enterprise-login"}>
            <button className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </SignOutButton>
        </div>
      </div>
    </div>
  );
}

// Public / pre-access routes that render WITHOUT the authenticated workspace
// chrome (marketing landing, pricing, onboarding, plan select, locked screen,
// and candidate-facing token pages). They bring their own header/layout.
const SHELL_BYPASS = [
  "/enterprise/home", "/enterprise/built-for", "/enterprise/industries", "/enterprise/pricing", "/enterprise/demo", "/enterprise/customers",
  "/enterprise/onboard", "/enterprise/plans",
  "/enterprise/locked", "/enterprise/invite", "/enterprise/book", "/enterprise/confirm",
  "/enterprise/reference", "/enterprise/interview", "/enterprise/offer-sign",
];

export function EnterpriseShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bypass = SHELL_BYPASS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const [org, setOrg] = useState<EnterpriseOrg | null>(null);
  const [ent, setEnt] = useState<Ent | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (bypass) return;
    fetch("/api/enterprise/org").then((r) => r.json()).then((j) => setOrg(j.data)).catch(() => {});
    fetch("/api/enterprise/me/entitlements")
      .then((r) => r.json())
      .then((j) => setEnt(j.data ? { planName: j.data.planName ?? null, accessStatus: j.data.accessStatus ?? null, trialEndsAt: j.data.trialEndsAt ?? null, features: j.data.features ?? [] } : { planName: null, accessStatus: null, trialEndsAt: null, features: [] }))
      .catch(() => {});
  }, [bypass]);

  // Public/pre-access pages: render bare (no sidebar/Sign-out chrome).
  if (bypass) return <>{children}</>;

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="hidden w-56 shrink-0 border-r border-border bg-card md:block print:!hidden">
        <div className="sticky top-0 h-screen">
          <Sidebar org={org} ent={ent} />
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-56 border-r border-border bg-card shadow-xl">
            <button onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted">
              <X className="h-5 w-5" />
            </button>
            <Sidebar org={org} ent={ent} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-border bg-card/80 px-4 backdrop-blur md:hidden print:!hidden">
          <button onClick={() => setMobileOpen(true)} className="rounded-md p-1 text-foreground hover:bg-muted">
            <Menu className="h-5 w-5" />
          </button>
          <p className="text-sm font-semibold">{org?.name ?? "Enterprise"}</p>
        </header>
        <NudgeBanner />
        {children}
      </div>

      {/* Global AI assistant — available on every enterprise page */}
      <AskAI />
    </div>
  );
}
