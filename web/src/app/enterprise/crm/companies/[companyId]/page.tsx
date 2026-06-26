"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2, ArrowLeft, Pencil, Globe, MapPin, Users, Plus, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { labelFor, type CrmCompany, type CrmContact, type CrmActivity, type CrmTask } from "@/lib/crm-shared";
import { CompanyForm } from "@/components/enterprise/crm/company-form";
import { ContactForm } from "@/components/enterprise/crm/contact-form";
import { ActivityTimeline, TasksPanel } from "@/components/enterprise/crm/activity-log";
import { fmtDate, COMPANY_STATUS_STYLES, RELATIONSHIP_STYLES, StatusBadge } from "@/components/enterprise/crm/crm-ui";

interface Payload { data: CrmCompany; contacts: CrmContact[]; activities: CrmActivity[]; tasks: CrmTask[] }
type Tab = "overview" | "contacts" | "activity" | "tasks";

const SOON: { label: string }[] = [{ label: "Job Orders" }, { label: "Deals" }, { label: "Submitted Candidates" }];

export default function CompanyDetail({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = use(params);
  const [p, setP] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");
  const [editOpen, setEditOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/enterprise/crm/companies/${companyId}`).then((r) => (r.ok ? r.json() : null)).then(setP).finally(() => setLoading(false));
  }, [companyId]);
  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!p) return <div className="px-6 py-20 text-center text-sm text-muted-foreground">Company not found.</div>;
  const c = p.data;
  const openTasks = p.tasks.filter((t) => t.status === "open").length;

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="border-b border-border bg-card px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <Link href="/enterprise/crm/companies" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Companies
          </Link>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold">{c.name}</h1>
                <StatusBadge value={c.status} styles={COMPANY_STATUS_STYLES} />
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {c.industry && <span>{c.industry}</span>}
                {c.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{c.location}</span>}
                {c.website && <a href={c.website.startsWith("http") ? c.website : `https://${c.website}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-primary"><Globe className="h-3 w-3" />{c.website}<ExternalLink className="h-2.5 w-2.5" /></a>}
                {c.size && <span>{c.size}</span>}
              </div>
            </div>
            <button onClick={() => setEditOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted">
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-1">
            {([["overview", "Overview"], ["contacts", `Contacts (${p.contacts.length})`], ["activity", `Activity (${p.activities.length})`], ["tasks", `Tasks (${openTasks})`]] as [Tab, string][]).map(([k, lbl]) => (
              <button key={k} onClick={() => setTab(k)}
                className={cn("rounded-lg px-3 py-1.5 text-sm font-medium transition-colors", tab === k ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}>
                {lbl}
              </button>
            ))}
            {SOON.map((s) => (
              <span key={s.label} className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground/50" title="Coming soon">
                {s.label}<span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase text-muted-foreground">Soon</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {tab === "overview" && (
          <div className="grid gap-5 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <div className="rounded-2xl border border-border bg-card p-5">
                <h2 className="mb-3 text-sm font-semibold">Details</h2>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  {([["Status", labelFor(c.status)], ["Industry", c.industry], ["Location", c.location], ["Company size", c.size], ["Source", c.source], ["Next follow-up", c.next_follow_up_at ? fmtDate(c.next_follow_up_at) : null]] as [string, string | null][]).map(([k, v]) => (
                    <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="mt-0.5 font-medium">{v || "—"}</dd></div>
                  ))}
                </dl>
                {c.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {c.tags.map((t) => <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{t}</span>)}
                  </div>
                )}
              </div>
              {c.notes && (
                <div className="rounded-2xl border border-border bg-card p-5">
                  <h2 className="mb-2 text-sm font-semibold">Notes</h2>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">{c.notes}</p>
                </div>
              )}
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-3 text-sm font-semibold">Recent activity</h2>
              {p.activities.length === 0 ? <p className="py-3 text-center text-xs text-muted-foreground">Nothing yet — log a call or note from the Activity tab.</p> : (
                <ul className="space-y-2 text-sm">
                  {p.activities.slice(0, 5).map((a) => (
                    <li key={a.id}><span className="font-medium">{labelFor(a.type)}</span>{a.subject && <span className="text-muted-foreground"> — {a.subject}</span>}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {tab === "contacts" && (
          <div>
            <div className="mb-3 flex justify-end">
              <button onClick={() => setContactOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted">
                <Plus className="h-3.5 w-3.5" /> Add contact
              </button>
            </div>
            {p.contacts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border py-14 text-center">
                <Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No contacts at this company yet.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-border">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-muted/30 text-left text-xs text-muted-foreground">
                    <tr><th className="px-4 py-3 font-medium">Name</th><th className="px-4 py-3 font-medium">Title</th><th className="hidden px-4 py-3 font-medium sm:table-cell">Type</th><th className="px-4 py-3 font-medium">Relationship</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {p.contacts.map((ct) => (
                      <tr key={ct.id} className="hover:bg-muted/20">
                        <td className="px-4 py-3"><Link href={`/enterprise/crm/contacts/${ct.id}`} className="font-medium hover:text-primary">{ct.first_name} {ct.last_name ?? ""}</Link></td>
                        <td className="px-4 py-3 text-muted-foreground">{ct.title ?? "—"}</td>
                        <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">{labelFor(ct.contact_type)}</td>
                        <td className="px-4 py-3"><StatusBadge value={ct.relationship_status} styles={RELATIONSHIP_STYLES} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === "activity" && <ActivityTimeline scope={{ company_id: companyId }} activities={p.activities} onChanged={load} />}
        {tab === "tasks" && <TasksPanel scope={{ company_id: companyId }} tasks={p.tasks} onChanged={load} />}
      </div>

      <CompanyForm open={editOpen} onClose={() => setEditOpen(false)} company={c} onSaved={() => load()} />
      <ContactForm open={contactOpen} onClose={() => setContactOpen(false)} companies={[{ id: c.id, name: c.name }]} defaultCompanyId={c.id} onSaved={() => load()} />
    </main>
  );
}
