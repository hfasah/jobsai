"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  LayoutGrid, Zap, Search, ScanSearch, Briefcase, Plus, CheckCircle2, Inbox,
  FileText, Sparkles, Send,
  Mic, MessageSquareText, Video, Headphones,
  BarChart3, LineChart, Settings2, CreditCard,
  Menu, X, ExternalLink, Coins, ChevronDown,
} from "lucide-react";
import { NotificationBell } from "@/components/layout/notification-bell";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

type NavItem = { label: string; href: string; icon: React.ElementType };
type NavSection = { heading: string; icon: React.ElementType; items: NavItem[] };

const PLAN_LABELS: Record<string, string> = {
  free: "Free", pro: "Pro", premium: "Premium", accelerator: "Accelerator",
};

const TOP: NavItem = { label: "Dashboard", href: "/dashboard", icon: LayoutGrid };

const SECTIONS: NavSection[] = [
  {
    heading: "Auto Apply", icon: Zap,
    items: [
      { label: "Job Search", href: "/dashboard/job-search", icon: ScanSearch },
      { label: "Discover Jobs", href: "/dashboard/discover", icon: Search },
      { label: "My Jobs", href: "/dashboard/jobs", icon: Briefcase },
      { label: "Import a Job", href: "/dashboard/jobs/import", icon: Plus },
      { label: "Approvals", href: "/dashboard/approve", icon: CheckCircle2 },
      { label: "Applications", href: "/dashboard/applications", icon: Inbox },
    ],
  },
  {
    heading: "Documents", icon: FileText,
    items: [
      { label: "Resumes", href: "/dashboard/resumes", icon: FileText },
      { label: "Skills Profile", href: "/dashboard/skills", icon: Sparkles },
      { label: "Apply Profile", href: "/dashboard/apply-profile", icon: Send },
    ],
  },
  {
    heading: "Interview Prep", icon: Mic,
    items: [
      { label: "Interview Buddy", href: "/dashboard/interview-buddy", icon: Headphones },
      { label: "Written Coach", href: "/dashboard/interview?mode=written", icon: MessageSquareText },
      { label: "Voice Interviewer", href: "/dashboard/interview?mode=voice", icon: Mic },
      { label: "Avatar Room", href: "/dashboard/interview?mode=avatar", icon: Video },
    ],
  },
  {
    heading: "Insights", icon: BarChart3,
    items: [
      { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
      { label: "Salaries", href: "/dashboard/salaries", icon: LineChart },
    ],
  },
];

const IMMERSIVE = ["/voice-interview", "/avatar-interview", "/resume-preview", "/resumes/preview"];

// Resolve the single active nav href from the current path (+ ?mode= for prep).
function computeActive(pathname: string, mode: string | null): string | null {
  for (const sec of SECTIONS) {
    for (const it of sec.items) {
      const qi = it.href.indexOf("?");
      if (qi >= 0) {
        const base = it.href.slice(0, qi);
        const m = new URLSearchParams(it.href.slice(qi + 1)).get("mode");
        if (pathname === base && mode === m) return it.href;
      }
    }
  }
  if (pathname === "/dashboard") return "/dashboard";
  let best: string | null = null, bestLen = -1;
  for (const it of SECTIONS.flatMap((s) => s.items)) {
    if (it.href.includes("?")) continue;
    const base = it.href;
    if (pathname === base || pathname.startsWith(base + "/")) {
      if (base.length > bestLen) { best = base; bestLen = base.length; }
    }
  }
  return best;
}

// Plan badge + token meter + Upgrade CTA — the persistent "upsell from inside" surface.
function SidebarUpsell({ onNavigate }: { onNavigate?: () => void }) {
  const [data, setData] = useState<{ balance: number; plan: string } | null>(null);
  useEffect(() => {
    let active = true;
    fetch("/api/tokens").then((r) => r.json())
      .then((j) => { if (active && j.data) setData({ balance: j.data.balance, plan: j.data.plan }); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const plan = data?.plan ?? "free";
  const isFree = plan === "free";
  const low = data !== null && data.balance < 50;

  return (
    <div className="mb-3 rounded-xl border border-border bg-background/40 p-3">
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
      <Link href="/dashboard/billing" onClick={onNavigate}
        className="btn-cta mt-3 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm">
        <Sparkles className="h-4 w-4" />
        {isFree ? "Upgrade plan" : low ? "Add tokens" : "Manage plan"}
      </Link>
    </div>
  );
}

function NavLink({ item, active, onNavigate, sub }: { item: NavItem; active: boolean; onNavigate?: () => void; sub?: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-lg text-sm font-medium transition-colors",
        sub ? "px-3 py-1.5" : "px-3 py-2",
        active
          ? "bg-gradient-brand text-white shadow-glow"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {item.label}
    </Link>
  );
}

function SidebarContent({ pathname, mode, onNavigate }: { pathname: string; mode: string | null; onNavigate?: () => void }) {
  const active = computeActive(pathname, mode);
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  const sectionHasActive = (sec: NavSection) => sec.items.some((it) => it.href === active);
  const isOpen = (sec: NavSection) => openMap[sec.heading] ?? sectionHasActive(sec);

  return (
    <div className="flex h-full flex-col">
      {/* Logo / home */}
      <div className="flex h-14 shrink-0 items-center px-5">
        <Link href="/dashboard" onClick={onNavigate} className="text-lg font-semibold tracking-tight">
          <span className="text-desyn-brand">{APP_NAME}</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        <div className="mb-3">
          <NavLink item={TOP} active={active === TOP.href} onNavigate={onNavigate} />
        </div>

        {SECTIONS.map((sec) => {
          const open = isOpen(sec);
          const SecIcon = sec.icon;
          const hasActive = sectionHasActive(sec);
          return (
            <div key={sec.heading} className="mb-1">
              <button
                onClick={() => setOpenMap((m) => ({ ...m, [sec.heading]: !open }))}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                  hasActive ? "text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                aria-expanded={open}
              >
                <SecIcon className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">{sec.heading}</span>
                <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")} />
              </button>
              {open && (
                <div className="ml-3 mt-0.5 space-y-0.5 border-l border-border pl-2">
                  {sec.items.map((it) => (
                    <NavLink key={it.href} item={it} active={it.href === active} onNavigate={onNavigate} sub />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="shrink-0 border-t border-border px-3 py-3">
        <SidebarUpsell onNavigate={onNavigate} />
        <div className="space-y-0.5">
          <NavLink item={{ label: "Preferences", href: "/dashboard/preferences", icon: Settings2 }} active={active === "/dashboard/preferences"} onNavigate={onNavigate} />
          <NavLink item={{ label: "Billing & Tokens", href: "/dashboard/billing", icon: CreditCard }} active={active === "/dashboard/billing"} onNavigate={onNavigate} />
          <Link href="/" onClick={onNavigate}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <ExternalLink className="h-4 w-4 shrink-0" /> Home page
          </Link>
        </div>
        <div className="mt-2 flex items-center justify-between px-1">
          <UserButton appearance={{ elements: { avatarBox: "h-8 w-8" } }} />
          <NotificationBell />
        </div>
      </div>
    </div>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode");
  const [mobileOpen, setMobileOpen] = useState(false);

  if (IMMERSIVE.some((s) => pathname.includes(s))) {
    return <>{children}</>;
  }

  return (
    <div className="dark flex min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-border bg-card md:block">
        <div className="sticky top-0 h-screen">
          <SidebarContent pathname={pathname} mode={mode} />
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 border-r border-border bg-card shadow-xl">
            <button onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 rounded-md p-1 text-muted-foreground hover:bg-muted" aria-label="Close menu">
              <X className="h-5 w-5" />
            </button>
            <SidebarContent pathname={pathname} mode={mode} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Content area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-border bg-card/80 px-4 backdrop-blur-sm md:hidden">
          <button onClick={() => setMobileOpen(true)} className="rounded-md p-1 text-foreground hover:bg-muted" aria-label="Open menu">
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
