"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, SignOutButton } from "@clerk/nextjs";
import {
  LayoutGrid, Briefcase, Users, BarChart3, Settings, Inbox, FileSpreadsheet, UsersRound, Globe, CalendarDays,
  Menu, X, Building2, ChevronRight, Sparkles, LogOut, FileText, Zap, Bot, ClipboardCheck, Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { EnterpriseOrg } from "@/types/enterprise";
import { AskAI } from "@/components/enterprise/ask-ai";

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
  { href: "/enterprise/team",      icon: UsersRound,       label: "Team & Access" },
  { href: "/enterprise/settings",  icon: Settings,         label: "Settings" },
];

function Sidebar({ org, features, onNavigate }: { org: EnterpriseOrg | null; features: string[] | null; onNavigate?: () => void }) {
  const pathname = usePathname();
  // features === null => entitlements not loaded yet, show everything optimistically.
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

export function EnterpriseShell({ children }: { children: React.ReactNode }) {
  const [org, setOrg] = useState<EnterpriseOrg | null>(null);
  const [features, setFeatures] = useState<string[] | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    fetch("/api/enterprise/org").then((r) => r.json()).then((j) => setOrg(j.data)).catch(() => {});
    fetch("/api/enterprise/me/entitlements")
      .then((r) => r.json())
      .then((j) => setFeatures(j.data?.features ?? []))
      .catch(() => {});
  }, []);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="hidden w-56 shrink-0 border-r border-border bg-card md:block print:!hidden">
        <div className="sticky top-0 h-screen">
          <Sidebar org={org} features={features} />
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
            <Sidebar org={org} features={features} onNavigate={() => setMobileOpen(false)} />
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
        {children}
      </div>

      {/* Global AI assistant — available on every enterprise page */}
      <AskAI />
    </div>
  );
}
