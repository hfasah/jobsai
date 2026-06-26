"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Building2, Users, Briefcase, TrendingUp, Activity, CheckSquare } from "lucide-react";
import { cn } from "@/lib/utils";

// Secondary CRM nav. `soon` items are shipped in later phases (Job Orders + Deals
// in PR2; Activities + Tasks pages in PR3) and render as clearly-marked,
// non-navigable placeholders until then.
const TABS: { href: string; label: string; icon: typeof LayoutGrid; soon?: boolean }[] = [
  { href: "/enterprise/crm",            label: "Dashboard",  icon: LayoutGrid },
  { href: "/enterprise/crm/companies",  label: "Companies",  icon: Building2 },
  { href: "/enterprise/crm/contacts",   label: "Contacts",   icon: Users },
  { href: "/enterprise/crm/job-orders", label: "Job Orders", icon: Briefcase },
  { href: "/enterprise/crm/deals",      label: "Deals",      icon: TrendingUp },
  { href: "/enterprise/crm/activities", label: "Activities", icon: Activity, soon: true },
  { href: "/enterprise/crm/tasks",      label: "Tasks",      icon: CheckSquare, soon: true },
];

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

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
        </div>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}
