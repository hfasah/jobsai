"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutGrid, Building2, Users, Briefcase, TrendingUp, Activity, CheckSquare, Search } from "lucide-react";
import { cn } from "@/lib/utils";

// Secondary CRM nav. `soon` items (if any) render as clearly-marked,
// non-navigable placeholders until the feature ships.
const TABS: { href: string; label: string; icon: typeof LayoutGrid; soon?: boolean }[] = [
  { href: "/enterprise/crm",            label: "Dashboard",  icon: LayoutGrid },
  { href: "/enterprise/crm/companies",  label: "Companies",  icon: Building2 },
  { href: "/enterprise/crm/contacts",   label: "Contacts",   icon: Users },
  { href: "/enterprise/crm/job-orders", label: "Job Orders", icon: Briefcase },
  { href: "/enterprise/crm/deals",      label: "Deals",      icon: TrendingUp },
  { href: "/enterprise/crm/activities", label: "Activities", icon: Activity },
  { href: "/enterprise/crm/tasks",      label: "Tasks",      icon: CheckSquare },
];

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [q, setQ] = useState("");

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim().length >= 2) router.push(`/enterprise/crm/search?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <div className="flex min-h-full flex-col">
      <div className="border-b border-border bg-card/60 px-4 sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto py-2.5">
          <span className="mr-2 hidden items-center gap-1.5 text-sm font-semibold sm:inline-flex">
            <span className="text-gradient">Recruiting CRM</span>
          </span>
          {TABS.map(({ href, label, icon: Icon, soon }) => {
            const active = href === "/enterprise/crm" ? pathname === href : pathname.startsWith(href);
            if (soon) {
              return (
                <span key={href}
                  className="inline-flex shrink-0 cursor-not-allowed items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground/50"
                  title="Coming soon">
                  <Icon className="h-4 w-4" /> {label}
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Soon</span>
                </span>
              );
            }
            return (
              <Link key={href} href={href}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
                )}>
                <Icon className="h-4 w-4" /> {label}
              </Link>
            );
          })}
          <form onSubmit={submitSearch} className="relative ml-auto shrink-0">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search CRM…"
              className="h-8 w-40 rounded-lg border border-border bg-background pl-8 pr-2 text-sm outline-none focus:w-56 focus:ring-2 focus:ring-primary" />
          </form>
        </div>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}
