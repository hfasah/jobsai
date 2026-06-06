"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  LayoutGrid, Briefcase, Users, BarChart3, Settings, Inbox, FileSpreadsheet,
  Menu, X, Building2, ChevronRight, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { EnterpriseOrg } from "@/types/enterprise";

const NAV = [
  { href: "/enterprise/dashboard", icon: LayoutGrid,       label: "Dashboard" },
  { href: "/enterprise/inbox",     icon: Inbox,            label: "Inbox" },
  { href: "/enterprise/jobs",      icon: Briefcase,        label: "Jobs" },
  { href: "/enterprise/candidates",icon: Users,            label: "Candidates" },
  { href: "/enterprise/analytics", icon: BarChart3,        label: "Analytics" },
  { href: "/enterprise/reports",   icon: FileSpreadsheet,  label: "Reports" },
  { href: "/enterprise/settings",  icon: Settings,         label: "Settings" },
];

function Sidebar({ org, onNavigate }: { org: EnterpriseOrg | null; onNavigate?: () => void }) {
  const pathname = usePathname();
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
        {NAV.map(({ href, icon: Icon, label }) => {
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
        <Link href="/dashboard"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
          <Sparkles className="h-4 w-4 shrink-0" />
          <span>Job Seeker Dashboard</span>
          <ChevronRight className="ml-auto h-3.5 w-3.5" />
        </Link>
        <div className="flex items-center justify-between px-1">
          <UserButton appearance={{ elements: { avatarBox: "h-8 w-8" } }} />
        </div>
      </div>
    </div>
  );
}

export function EnterpriseShell({ children }: { children: React.ReactNode }) {
  const [org, setOrg] = useState<EnterpriseOrg | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    fetch("/api/enterprise/org").then((r) => r.json()).then((j) => setOrg(j.data)).catch(() => {});
  }, []);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="hidden w-56 shrink-0 border-r border-border bg-card md:block">
        <div className="sticky top-0 h-screen">
          <Sidebar org={org} />
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
            <Sidebar org={org} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-border bg-card/80 px-4 backdrop-blur md:hidden">
          <button onClick={() => setMobileOpen(true)} className="rounded-md p-1 text-foreground hover:bg-muted">
            <Menu className="h-5 w-5" />
          </button>
          <p className="text-sm font-semibold">{org?.name ?? "Enterprise"}</p>
        </header>
        {children}
      </div>
    </div>
  );
}
