"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Search, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { RELATIONSHIP_STATUSES, labelFor, type CrmContact } from "@/lib/crm-shared";
import { ContactForm } from "@/components/enterprise/crm/contact-form";
import { fmtDate, relativeTime, isOverdue, RELATIONSHIP_STYLES, StatusBadge } from "@/components/enterprise/crm/crm-ui";

type Row = CrmContact & { company?: { id: string; name: string } | null };

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Row[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(() => {
    Promise.all([
      fetch("/api/enterprise/crm/contacts").then((r) => r.json()),
      fetch("/api/enterprise/crm/companies").then((r) => r.json()),
    ]).then(([cs, co]) => {
      setContacts(cs.data ?? []);
      setCompanies((co.data ?? []).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
    }).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: contacts.length };
    for (const s of RELATIONSHIP_STATUSES) c[s] = contacts.filter((x) => x.relationship_status === s).length;
    return c;
  }, [contacts]);

  const visible = contacts
    .filter((c) => filter === "all" || c.relationship_status === filter)
    .filter((c) => !search.trim() || `${c.first_name} ${c.last_name ?? ""} ${c.email ?? ""} ${c.title ?? ""}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">Contacts</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">Hiring managers, HR, and decision-makers.</p>
          </div>
          <button onClick={() => setFormOpen(true)} className="btn-cta inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold">
            <Plus className="h-4 w-4" /> New contact
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {["all", ...RELATIONSHIP_STATUSES].map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                filter === s ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>
              {s === "all" ? "All" : labelFor(s)} ({counts[s] ?? 0})
            </button>
          ))}
          <div className="relative ml-auto">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…"
              className="h-8 w-44 rounded-lg border border-border bg-background pl-8 pr-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
          </div>
        </div>

        <div className="mt-4">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : visible.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border py-16 text-center">
              <Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">{contacts.length === 0 ? "No contacts yet." : "No contacts match your filters."}</p>
              {contacts.length === 0 && <p className="mt-1 text-xs text-muted-foreground">Add the people you work with at your client companies.</p>}
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="hidden px-4 py-3 font-medium sm:table-cell">Company</th>
                    <th className="hidden px-4 py-3 font-medium md:table-cell">Title</th>
                    <th className="px-4 py-3 font-medium">Relationship</th>
                    <th className="hidden px-4 py-3 font-medium lg:table-cell">Last contacted</th>
                    <th className="px-4 py-3 font-medium">Next follow-up</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visible.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <Link href={`/enterprise/crm/contacts/${c.id}`} className="font-medium hover:text-primary">{c.first_name} {c.last_name ?? ""}</Link>
                        <span className="ml-2 text-xs text-muted-foreground">{labelFor(c.contact_type)}</span>
                      </td>
                      <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                        {c.company ? <Link href={`/enterprise/crm/companies/${c.company.id}`} className="hover:text-primary">{c.company.name}</Link> : "—"}
                      </td>
                      <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{c.title ?? "—"}</td>
                      <td className="px-4 py-3"><StatusBadge value={c.relationship_status} styles={RELATIONSHIP_STYLES} /></td>
                      <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">{relativeTime(c.last_contacted_at)}</td>
                      <td className={cn("px-4 py-3", isOverdue(c.next_follow_up_at) ? "font-medium text-red-500" : "text-muted-foreground")}>
                        {c.next_follow_up_at ? fmtDate(c.next_follow_up_at) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <ContactForm open={formOpen} onClose={() => setFormOpen(false)} companies={companies} onSaved={() => load()} />
    </main>
  );
}
