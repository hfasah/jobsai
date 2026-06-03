"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  LayoutGrid, Zap, Briefcase, Inbox, CheckCircle2,
  FileText, Sparkles, Send,
  BarChart3, Settings2, CreditCard,
  Menu, X, ExternalLink, Coins,
} from "lucide-react";
import { NotificationBell } from "@/components/layout/notification-bell";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

type NavItem = { label: string; href: string; icon: React.ElementType };
type NavGroup = { heading: string; items: NavItem[] };

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  premium: "Premium",
  accelerator: "Accelerator",
};

// Plan badge + token meter + Upgrade CTA — the persistent "upsell from inside" surface.
function SidebarUpsell({ onNavigate }: { onNavigate?: () => void }) {
  const [data, setData] = useState<{ balance: number; plan: string } | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/tokens")
      .then((r) => r.json())
      .then((j) => { if (active && j.data) setData({ balance: j.data.balance, plan: j.data.plan }); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const plan = data?.plan ?? "free";
  const isFree = plan === "free";
  const low = data !== null && data.balance < 50;

  return (
    <div className="mx-1 mb-3 rounded-xl border border-border bg-background/40 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Plan</span>
        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
          {PLAN_LABELS[plan] ?? plan}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-sm font-semibold tabular-nums">
        <Coins className={cn("h-4 w-4", low ? "text-destructive" : "text-desyn-accent")} />
        <span className={low ? "text-destructive" : "text-foreground"}>
          {data === null ? "…" : data.balance.toLocaleString()}
        </span>
        <span className="text-xs font-normal text-muted-foreground">tokens</span>
      </div>
      <Link
        href="/dashboard/billing"
        onClick={onNavigate}
        className="btn-cta mt-3 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm"
      >
        <Sparkles className="h-4 w-4" />
        {isFree ? "Upgrade plan" : low ? "Add tokens" : "Manage plan"}
      </Link>
    </div>
  );
}

const NAV: NavGroup[] = [
  {
    heading: "Auto Apply",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutGrid },
      { label: "Discover", href: "/dashboard/discover", icon: Zap },
      { label: "Jobs", href: "/dashboard/jobs", icon: Briefcase },
      { label: "Applications", href: "/dashboard/applications", icon: Inbox },
      { label: "Approvals", href: "/dashboard/approve", icon: CheckCircle2 },
    ],
  },
  {
    heading: "Documents",
    items: [
      { label: "Resumes", href: "/dashboard/resumes", icon: FileText },
      { label: "Skills", href: "/dashboard/skills", icon: Sparkles },
      { label: "Apply Profile", href: "/dashboard/apply-profile", icon: Send },
    ],
  },
  {
    heading: "Account",
    items: [
      { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
      { label: "Preferences", href: "/dashboard/preferences", icon: Settings2 },
      { label: "Billing & Tokens", href: "/dashboard/billing", icon: CreditCard },
    ],
  },
];

// Full-screen experiences render without the app shell.
const IMMERSIVE = ["/voice-interview", "/avatar-interview", "/interview-buddy", "/resume-preview"];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}

function SidebarContent({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      {/* Logo / home */}
      <div className="flex h-14 shrink-0 items-center px-5">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="text-lg font-semibold tracking-tight"
        >
          <span className="text-desyn-brand">{APP_NAME}</span>
        </Link>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {NAV.map((group) => (
          <div key={group.heading} className="mb-5">
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.heading}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer: upsell + home link + account */}
      <div className="shrink-0 border-t border-border px-3 py-3">
        <SidebarUpsell onNavigate={onNavigate} />
        <Link
          href="/"
          onClick={onNavigate}
          className="mb-2 flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ExternalLink className="h-4 w-4 shrink-0" />
          Home page
        </Link>
        <div className="flex items-center justify-between px-1">
          <UserButton appearance={{ elements: { avatarBox: "h-8 w-8" } }} />
          <NotificationBell />
        </div>
      </div>
    </div>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const [mobileOpen, setMobileOpen] = useState(false);

  // Immersive routes: no shell.
  if (IMMERSIVE.some((s) => pathname.includes(s))) {
    return <>{children}</>;
  }

  return (
    <div className="dark flex min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-border bg-card md:block">
        <div className="sticky top-0 h-screen">
          <SidebarContent pathname={pathname} />
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-64 border-r border-border bg-card shadow-xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 rounded-md p-1 text-muted-foreground hover:bg-muted"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent pathname={pathname} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Content area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex h-14 items-center gap-3 border-b border-border bg-card/80 px-4 backdrop-blur-sm md:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-1 text-foreground hover:bg-muted"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
            <span className="text-desyn-brand">{APP_NAME}</span>
          </Link>
        </header>

        {children}
      </div>
    </div>
  );
}
