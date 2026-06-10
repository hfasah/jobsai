"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  LayoutGrid, Zap, Search, ScanSearch, Briefcase, Plus, CheckCircle2, Inbox, Mail,
  FileText, Sparkles, Send,
  Wand2, PenLine, Puzzle,
  Mic, MessageSquareText, Video, Headphones, UserRound, ClipboardCheck,
  BarChart3, LineChart, Settings2, CreditCard, Bot,
  Menu, X, ExternalLink, Coins, ChevronDown,
  Sun, Moon, Monitor,
} from "lucide-react";
import { useTheme } from "next-themes";
import { NotificationBell } from "@/components/layout/notification-bell";
import { CreditMeter } from "@/components/layout/credit-meter";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useI18n, LOCALES, type Locale } from "@/lib/i18n";

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

type NavItem = { label: string; href: string; icon: React.ElementType };
type NavSection = { heading: string; icon: React.ElementType; items: NavItem[] };

const PLAN_LABELS: Record<string, string> = {
  free: "Free", pro: "Pro", premium: "Premium", accelerator: "Accelerator",
};

const TOP: NavItem = { label: "nav.dashboard", href: "/dashboard", icon: LayoutGrid };

const SECTIONS: NavSection[] = [
  {
    heading: "nav.autoApply", icon: Zap,
    items: [
      { label: "nav.jobSearch",    href: "/dashboard/job-search",          icon: ScanSearch },
      { label: "nav.discoverJobs", href: "/dashboard/discover",            icon: Search },
      { label: "nav.myJobs",       href: "/dashboard/jobs",                icon: Briefcase },
      { label: "nav.importJob",    href: "/dashboard/jobs/import",         icon: Plus },
      { label: "nav.approvals",    href: "/dashboard/approve",             icon: CheckCircle2 },
      { label: "nav.applications",  href: "/dashboard/applications",  icon: Inbox },
      { label: "nav.inbox",         href: "/dashboard/inbox",         icon: Mail },
      { label: "nav.autoApplyLog",  href: "/dashboard/auto-apply",    icon: Bot },
    ],
  },
  {
    heading: "nav.documents", icon: FileText,
    items: [
      { label: "nav.resumes",       href: "/dashboard/resumes",       icon: FileText },
      { label: "nav.skillsProfile", href: "/dashboard/skills",        icon: Sparkles },
      { label: "nav.applyProfile",  href: "/dashboard/apply-profile", icon: Send },
    ],
  },
  {
    heading: "nav.linkedin", icon: LinkedInIcon,
    items: [
      { label: "nav.profileOptimizer", href: "/dashboard/linkedin/profile", icon: Wand2 },
      { label: "nav.contentStudio",    href: "/dashboard/linkedin/posts",   icon: PenLine },
      { label: "nav.browserExtension", href: "/dashboard/extension",        icon: Puzzle },
    ],
  },
  {
    heading: "nav.interviewPrep", icon: Mic,
    items: [
      { label: "nav.interviewBuddy",   href: "/dashboard/interview-buddy",       icon: Headphones },
      { label: "nav.writtenCoach",     href: "/dashboard/interview?mode=written", icon: MessageSquareText },
      { label: "nav.voiceInterviewer", href: "/dashboard/interview?mode=voice",   icon: Mic },
      { label: "nav.avatarRoom",       href: "/dashboard/interview?mode=avatar",  icon: Video },
    ],
  },
  {
    heading: "nav.insights", icon: BarChart3,
    items: [
      { label: "nav.analytics", href: "/dashboard/analytics", icon: BarChart3 },
      { label: "nav.salaries",  href: "/dashboard/salaries",  icon: LineChart },
      { label: "Referrals",     href: "/dashboard/referrals", icon: Coins },
    ],
  },
];

// Voice/avatar interviews keep the dashboard left menu (not a full-screen takeover).
const IMMERSIVE = ["/resume-preview", "/resumes/preview"];

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
  const [data, setData] = useState<{ balance: number; plan: string; grant: number; applyCost: number } | null>(null);
  const { t } = useI18n();
  useEffect(() => {
    let active = true;
    fetch("/api/tokens").then((r) => r.json())
      .then((j) => {
        if (active && j.data) setData({
          balance: j.data.balance,
          plan: j.data.plan,
          grant: j.data.monthly_grant ?? 0,
          applyCost: j.data.costs?.auto_apply ?? 600,
        });
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const plan = data?.plan ?? "free";
  const isFree = plan === "free";
  // "Low" means they can't afford a single auto-apply.
  const low = data !== null && data.balance < (data.applyCost || 600);
  // Usage bar vs the monthly allowance (capped at 100%).
  const pct = data && data.grant > 0 ? Math.min(100, Math.round((data.balance / data.grant) * 100)) : 0;

  return (
    <div className="mb-3 rounded-xl border border-border bg-background/40 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{t("sidebar.plan")}</span>
        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
          {PLAN_LABELS[plan] ?? plan}
        </span>
      </div>
      <div className="mt-2 flex items-baseline gap-1.5 tabular-nums">
        <Coins className={cn("h-4 w-4 self-center", low ? "text-destructive" : "text-desyn-accent")} />
        <span className={cn("text-sm font-semibold", low ? "text-destructive" : "text-foreground")}>
          {data === null ? "…" : data.balance.toLocaleString()}
        </span>
        {data && data.grant > 0 && (
          <span className="text-[11px] font-normal text-muted-foreground">/ {data.grant.toLocaleString()}</span>
        )}
        <span className="text-xs font-normal text-muted-foreground">credits</span>
      </div>
      {data && data.grant > 0 && (
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full transition-all", low ? "bg-destructive" : "bg-desyn-accent")}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {data && (
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          {low ? "Not enough to auto-apply — top up." : `~${Math.floor(data.balance / (data.applyCost || 600))} auto-applies left`}
        </p>
      )}
      <Link href="/dashboard/billing" onClick={onNavigate}
        className="btn-cta mt-3 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm">
        <Sparkles className="h-4 w-4" />
        {isFree ? t("sidebar.upgradePlan") : low ? t("sidebar.addTokens") : t("sidebar.managePlan")}
      </Link>
    </div>
  );
}

function NavLink({ item, active, onNavigate, sub }: { item: NavItem; active: boolean; onNavigate?: () => void; sub?: boolean }) {
  const Icon = item.icon;
  const { t } = useI18n();
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
      {t(item.label)}
    </Link>
  );
}

function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <span className="text-base leading-none">{current.flag}</span>
        <span className="flex-1 text-left text-xs font-medium">{current.label}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-1 w-full overflow-hidden rounded-xl border border-border bg-card shadow-xl">
          {LOCALES.map((l) => (
            <button
              key={l.code}
              onClick={() => { setLocale(l.code as Locale); setOpen(false); }}
              className={cn(
                "flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-muted",
                l.code === locale ? "text-foreground font-semibold" : "text-muted-foreground"
              )}
            >
              <span className="text-base leading-none">{l.flag}</span>
              {l.label}
              {l.code === locale && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const opts = [
    { v: "light", icon: Sun, label: "Light" },
    { v: "system", icon: Monitor, label: "System" },
    { v: "dark", icon: Moon, label: "Dark" },
  ] as const;
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-border bg-muted/50 p-0.5">
      {opts.map(({ v, icon: Icon, label }) => (
        <button
          key={v}
          onClick={() => setTheme(v)}
          title={label}
          className={cn(
            "flex flex-1 items-center justify-center rounded-md p-1.5 transition-colors",
            theme === v
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}

function SidebarContent({ pathname, mode, onNavigate }: { pathname: string; mode: string | null; onNavigate?: () => void }) {
  const active = computeActive(pathname, mode);
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  const { t } = useI18n();
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
        <div className="mb-3 space-y-0.5">
          <NavLink item={TOP} active={active === TOP.href} onNavigate={onNavigate} />
          <NavLink item={{ label: "Set Up Profile", href: "/dashboard/setup", icon: ClipboardCheck }} active={active === "/dashboard/setup"} onNavigate={onNavigate} />
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
                <span className="flex-1 text-left">{t(sec.heading)}</span>
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

        {/* Free coaching call CTA */}
        <Link href="/dashboard/coaching" onClick={onNavigate}
          className="btn-cta mt-3 flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold shadow-glow">
          <UserRound className="h-4 w-4 shrink-0" />
          Book Free Career Call
        </Link>
      </nav>

      {/* Footer */}
      <div className="shrink-0 border-t border-border px-3 py-3">
        <SidebarUpsell onNavigate={onNavigate} />
        <div className="space-y-0.5">
          <NavLink item={{ label: "nav.preferences",  href: "/dashboard/preferences", icon: Settings2 }} active={active === "/dashboard/preferences"} onNavigate={onNavigate} />
          <NavLink item={{ label: "nav.billingTokens", href: "/dashboard/billing",     icon: CreditCard }}  active={active === "/dashboard/billing"}     onNavigate={onNavigate} />
          <Link href="/" onClick={onNavigate}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <ExternalLink className="h-4 w-4 shrink-0" /> {t("nav.homePage")}
          </Link>
        </div>
        <div className="mt-2 px-0.5">
          <LanguageSwitcher />
        </div>
        <div className="mt-2 px-1">
          <ThemeToggle />
        </div>
        <div className="mt-2 flex flex-col gap-3">
          <CreditMeter />
          <div className="flex items-center justify-between px-1">
            <UserButton appearance={{ elements: { avatarBox: "h-8 w-8" } }} />
            <NotificationBell />
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode");
  const [mobileOpen, setMobileOpen] = useState(false);

  if (IMMERSIVE.some((s) => pathname.includes(s))) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
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

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="flex min-h-screen bg-background" />}>
      <DashboardShellInner>{children}</DashboardShellInner>
    </Suspense>
  );
}
