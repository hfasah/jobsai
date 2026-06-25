"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ArrowLeft, Pencil, Mail, Phone, Linkedin, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { labelFor, type CrmContact, type CrmActivity, type CrmTask } from "@/lib/enterprise-crm";
import { ContactForm } from "@/components/enterprise/crm/contact-form";
import { ActivityTimeline, TasksPanel } from "@/components/enterprise/crm/activity-log";
import { fmtDate, RELATIONSHIP_STYLES, StatusBadge } from "@/components/enterprise/crm/crm-ui";

type ContactRow = CrmContact & { company?: { id: string; name: string } | null };
interface Payload { data: ContactRow; activities: CrmActivity[]; tasks: CrmTask[] }
type Tab = "overview" | "activity" | "tasks";

export default function ContactDetail({ params }: { params: Promise<{ contactId: string }> }) {
  const { contactId } = use(params);
  const [p, setP] = useState<Payload | null>(null);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");
  const [editOpen, setEditOpen] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/enterprise/crm/contacts/${contactId}`).then((r) => (r.ok ? r.json() : null)).then(setP).finally(() => setLoading(false));
  }, [contactId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetch("/api/enterprise/crm/companies").then((r) => r.json()).then((j) => setCompanies((j.data ?? []).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })))); }, []);

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!p) return <div className="px-6 py-20 text-center text-sm text-muted-foreground">Contact not found.</div>;
  const c = p.data;
  const openTasks = p.tasks.filter((t) => t.status === "open").length;
  const link = (href: string, Icon: typeof Mail, text: string) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-primary"><Icon className="h-3 w-3" />{text}</a>
  );

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="border-b border-border bg-card px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <Link href="/enterprise/crm/contacts" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Contacts
          </Link>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold">{c.first_name} {c.last_name ?? ""}</h1>
                <StatusBadge value={c.relationship_status} styles={RELATIONSHIP_STYLES} />
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {c.title && <span>{c.title}</span>}
                {c.company && <Link href={`/enterprise/crm/companies/${c.company.id}`} className="inline-flex items-center gap-1 hover:text-primary"><Building2 className="h-3 w-3" />{c.company.name}</Link>}
                {c.email && link(`mailto:${c.email}`, Mail, c.email)}
                {c.phone && link(`tel:${c.phone}`, Phone, c.phone)}
                {c.linkedin_url && link(c.linkedin_url.startsWith("http") ? c.linkedin_url : `https://${c.linkedin_url}`, Linkedin, "LinkedIn")}
              </div>
            </div>
            <button onClick={() => setEditOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted">
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-1">
            {([["overview", "Overview"], ["activity", `Activity (${p.activities.length})`], ["tasks", `Tasks (${openTasks})`]] as [Tab, string][]).map(([k, lbl]) => (
              <button key={k} onClick={() => setTab(k)}
                className={cn("rounded-lg px-3 py-1.5 text-sm font-medium transition-colors", tab === k ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}>
                {lbl}
              </button>
            ))}
            <span className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground/50" title="Coming soon">
              Submissions<span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase text-muted-foreground">Soon</span>
            </span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {tab === "overview" && (
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-3 text-sm font-semibold">Details</h2>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                {([["Type", labelFor(c.contact_type)], ["Relationship", labelFor(c.relationship_status)], ["Company", c.company?.name ?? null], ["Email", c.email], ["Phone", c.phone], ["Next follow-up", c.next_follow_up_at ? fmtDate(c.next_follow_up_at) : null]] as [string, string | null][]).map(([k, v]) => (
                  <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="mt-0.5 font-medium">{v || "—"}</dd></div>
                ))}
              </dl>
              {c.tags.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{c.tags.map((t) => <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{t}</span>)}</div>}
            </div>
            {c.notes && (
              <div className="rounded-2xl border border-border bg-card p-5">
                <h2 className="mb-2 text-sm font-semibold">Notes</h2>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{c.notes}</p>
              </div>
            )}
          </div>
        )}
        {tab === "activity" && <ActivityTimeline scope={{ contact_id: contactId, ...(c.company_id ? { company_id: c.company_id } : {}) }} activities={p.activities} onChanged={load} />}
        {tab === "tasks" && <TasksPanel scope={{ contact_id: contactId, ...(c.company_id ? { company_id: c.company_id } : {}) }} tasks={p.tasks} onChanged={load} />}
      </div>

      <ContactForm open={editOpen} onClose={() => setEditOpen(false)} contact={c} companies={companies} onSaved={() => load()} />
    </main>
  );
}
