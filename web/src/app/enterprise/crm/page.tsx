"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2, Building2, Users, CalendarClock, AlertTriangle, Sparkles, ArrowRight, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { labelFor } from "@/lib/enterprise-crm";
import { fmtDate, relativeTime, COMPANY_STATUS_STYLES, StatusBadge } from "@/components/enterprise/crm/crm-ui";

interface Dashboard {
  stats: {
    prospects: number; activeClients: number; pastClients: number; dormant: number;
    totalCompanies: number; totalContacts: number; openTasks: number; overdueTasks: number; followupsDueToday: number;
  };
  lists: {
    tasksDueToday: { id: string; title: string; due_at: string | null; company?: { id: string; name: string } | null }[];
    overdueTasks: { id: string; title: string; due_at: string | null; company?: { id: string; name: string } | null }[];
    recentlyActive: { id: string; name: string; status: string; last_activity_at: string | null }[];
    recentCompanies: { id: string; name: string; status: string; created_at: string }[];
    dormantCompanies: { id: string; name: string; status: string }[];
    staleContacts: { id: string; first_name: string; last_name: string | null; relationship_status: string; last_contacted_at: string | null }[];
  };
}

function StatCard({ icon: Icon, label, value, tone }: { icon: typeof Building2; label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className={cn("h-4 w-4", tone)} />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-1.5 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function ListCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </div>
  );
}

const empty = (msg: string) => <p className="py-4 text-center text-xs text-muted-foreground">{msg}</p>;

export default function CrmDashboard() {
  const [d, setD] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    fetch("/api/enterprise/crm/dashboard")
      .then((r) => { if (r.status === 403) setLocked(true); return r.ok ? r.json() : null; })
      .then((j) => j && setD(j))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (locked) return (
    <div className="mx-auto max-w-md px-6 py-20 text-center">
      <Sparkles className="mx-auto mb-3 h-8 w-8 text-primary" />
      <h1 className="text-lg font-bold">Recruiting CRM</h1>
      <p className="mt-2 text-sm text-muted-foreground">The CRM isn’t included in your current plan. Upgrade to manage clients, contacts, job orders, and deals alongside your candidates.</p>
      <Link href="/enterprise/billing" className="btn-cta mt-4 inline-flex rounded-xl px-4 py-2 text-sm font-semibold">View plans</Link>
    </div>
  );
  if (!d) return empty("Couldn’t load the CRM dashboard.");

  const s = d.stats;
  return (
    <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-xl font-bold">CRM Dashboard</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Your client relationships at a glance.</p>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={Building2} label="Prospects" value={s.prospects} tone="text-blue-500" />
          <StatCard icon={Building2} label="Active clients" value={s.activeClients} tone="text-green-500" />
          <StatCard icon={CalendarClock} label="Follow-ups due today" value={s.followupsDueToday} tone="text-amber-500" />
          <StatCard icon={AlertTriangle} label="Overdue tasks" value={s.overdueTasks} tone="text-red-500" />
          <StatCard icon={Users} label="Contacts" value={s.totalContacts} />
          <StatCard icon={Building2} label="Total companies" value={s.totalCompanies} />
          <StatCard icon={Clock} label="Dormant clients" value={s.dormant} tone="text-amber-500" />
          <StatCard icon={CalendarClock} label="Open tasks" value={s.openTasks} />
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <ListCard title="Tasks due today">
            {d.lists.tasksDueToday.length === 0 ? empty("Nothing due today. 🎉") : (
              <ul className="space-y-2">
                {d.lists.tasksDueToday.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate">{t.title}{t.company && <span className="text-muted-foreground"> · {t.company.name}</span>}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{fmtDate(t.due_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </ListCard>

          <ListCard title="Overdue tasks">
            {d.lists.overdueTasks.length === 0 ? empty("No overdue tasks.") : (
              <ul className="space-y-2">
                {d.lists.overdueTasks.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate">{t.title}{t.company && <span className="text-muted-foreground"> · {t.company.name}</span>}</span>
                    <span className="shrink-0 text-xs text-red-500">{fmtDate(t.due_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </ListCard>

          <ListCard title="Recently active clients">
            {d.lists.recentlyActive.length === 0 ? empty("No activity yet.") : (
              <ul className="divide-y divide-border">
                {d.lists.recentlyActive.map((c) => (
                  <li key={c.id}>
                    <Link href={`/enterprise/crm/companies/${c.id}`} className="flex items-center justify-between gap-3 py-2 text-sm hover:text-primary">
                      <span className="flex items-center gap-2 truncate"><StatusBadge value={c.status} styles={COMPANY_STATUS_STYLES} /> {c.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(c.last_activity_at)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </ListCard>

          <ListCard title="Dormant clients needing attention">
            {d.lists.dormantCompanies.length === 0 ? empty("No dormant clients.") : (
              <ul className="divide-y divide-border">
                {d.lists.dormantCompanies.map((c) => (
                  <li key={c.id}>
                    <Link href={`/enterprise/crm/companies/${c.id}`} className="flex items-center justify-between gap-3 py-2 text-sm hover:text-primary">
                      <span className="truncate">{c.name}</span><ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </ListCard>

          <ListCard title="Recently added companies">
            {d.lists.recentCompanies.length === 0 ? empty("No companies yet.") : (
              <ul className="divide-y divide-border">
                {d.lists.recentCompanies.map((c) => (
                  <li key={c.id}>
                    <Link href={`/enterprise/crm/companies/${c.id}`} className="flex items-center justify-between gap-3 py-2 text-sm hover:text-primary">
                      <span className="flex items-center gap-2 truncate"><StatusBadge value={c.status} styles={COMPANY_STATUS_STYLES} /> {c.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{fmtDate(c.created_at)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </ListCard>

          <ListCard title="Contacts not touched in 14+ days">
            {d.lists.staleContacts.length === 0 ? empty("Everyone’s been followed up. 👍") : (
              <ul className="divide-y divide-border">
                {d.lists.staleContacts.map((c) => (
                  <li key={c.id}>
                    <Link href={`/enterprise/crm/contacts/${c.id}`} className="flex items-center justify-between gap-3 py-2 text-sm hover:text-primary">
                      <span className="truncate">{c.first_name} {c.last_name ?? ""} <span className="text-muted-foreground">· {labelFor(c.relationship_status)}</span></span>
                      <span className="shrink-0 text-xs text-muted-foreground">{c.last_contacted_at ? relativeTime(c.last_contacted_at) : "never"}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </ListCard>
        </div>
      </div>
    </main>
  );
}
