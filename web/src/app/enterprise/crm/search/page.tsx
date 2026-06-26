"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, Search, Building2, Users, Briefcase, TrendingUp } from "lucide-react";
import { labelFor } from "@/lib/crm-shared";

interface Results {
  companies: { id: string; name: string; status: string; industry: string | null }[];
  contacts: { id: string; first_name: string; last_name: string | null; title: string | null; company?: { name: string } | null }[];
  jobOrders: { id: string; title: string; status: string; company?: { name: string } | null }[];
  deals: { id: string; name: string; stage: string; company?: { name: string } | null }[];
}

function SearchResults() {
  const sp = useSearchParams();
  const q = sp.get("q") ?? "";
  const [results, setResults] = useState<Results | null>(null);
  const short = q.trim().length < 2;

  useEffect(() => {
    if (short) return;
    let active = true;
    fetch(`/api/enterprise/crm/search?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((j) => { if (active) setResults(j); })
      .catch(() => { if (active) setResults(null); });
    return () => { active = false; };
  }, [q, short]);

  const loading = !short && !results;
  const total = results ? results.companies.length + results.contacts.length + results.jobOrders.length + results.deals.length : 0;

  return (
    <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-xl font-bold">Search</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{q ? <>Results for “<span className="text-foreground">{q}</span>”</> : "Search companies, contacts, job orders, and deals."}</p>

        <div className="mt-5">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : !results || total === 0 ? (
            <div className="rounded-2xl border border-dashed border-border py-16 text-center">
              <Search className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">{q.trim().length < 2 ? "Type at least 2 characters." : "No matches."}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {results.companies.length > 0 && (
                <Group title="Companies" icon={Building2}>
                  {results.companies.map((c) => (
                    <Link key={c.id} href={`/enterprise/crm/companies/${c.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-muted/30">
                      <span className="truncate font-medium">{c.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{c.industry ?? labelFor(c.status)}</span>
                    </Link>
                  ))}
                </Group>
              )}
              {results.contacts.length > 0 && (
                <Group title="Contacts" icon={Users}>
                  {results.contacts.map((c) => (
                    <Link key={c.id} href={`/enterprise/crm/contacts/${c.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-muted/30">
                      <span className="truncate font-medium">{c.first_name} {c.last_name ?? ""}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{c.title ?? c.company?.name ?? ""}</span>
                    </Link>
                  ))}
                </Group>
              )}
              {results.jobOrders.length > 0 && (
                <Group title="Job Orders" icon={Briefcase}>
                  {results.jobOrders.map((j) => (
                    <Link key={j.id} href={`/enterprise/crm/job-orders/${j.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-muted/30">
                      <span className="truncate font-medium">{j.title}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{j.company?.name ?? labelFor(j.status)}</span>
                    </Link>
                  ))}
                </Group>
              )}
              {results.deals.length > 0 && (
                <Group title="Deals" icon={TrendingUp}>
                  {results.deals.map((d) => (
                    <div key={d.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm">
                      <span className="truncate font-medium">{d.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{d.company?.name ?? labelFor(d.stage)}</span>
                    </div>
                  ))}
                </Group>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function Group({ title, icon: Icon, children }: { title: string; icon: typeof Building2; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Icon className="h-3.5 w-3.5" /> {title}</h2>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

export default function CrmSearchPage() {
  return (
    <Suspense fallback={<div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
      <SearchResults />
    </Suspense>
  );
}
