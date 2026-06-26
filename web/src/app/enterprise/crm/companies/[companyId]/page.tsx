"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2, ArrowLeft, Pencil, Globe, MapPin, Users, Plus, ExternalLink, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { labelFor, type CrmCompany, type CrmContact, type CrmActivity, type CrmTask, type CrmJobOrder, type CrmDeal, type CrmSubmission } from "@/lib/crm-shared";
import { CompanyForm } from "@/components/enterprise/crm/company-form";
import { ContactForm } from "@/components/enterprise/crm/contact-form";
import { JobOrderForm } from "@/components/enterprise/crm/job-order-form";
import { DealForm } from "@/components/enterprise/crm/deal-form";
import { SubmissionForm } from "@/components/enterprise/crm/submission-form";
import { ActivityTimeline, TasksPanel } from "@/components/enterprise/crm/activity-log";
import { CrmAiModal } from "@/components/enterprise/crm/crm-ai-modal";
import { fmtDate, fmtMoney, COMPANY_STATUS_STYLES, RELATIONSHIP_STYLES, JOB_ORDER_STATUS_STYLES, DEAL_STAGE_STYLES, SUBMISSION_STATUS_STYLES, StatusBadge } from "@/components/enterprise/crm/crm-ui";

type SubmissionRow = CrmSubmission & { job_order?: { id: string; title: string } | null };
interface Payload { data: CrmCompany; contacts: CrmContact[]; activities: CrmActivity[]; tasks: CrmTask[]; jobOrders: CrmJobOrder[]; deals: CrmDeal[]; submissions: SubmissionRow[] }
type Tab = "overview" | "contacts" | "joborders" | "deals" | "submissions" | "activity" | "tasks";

export default function CompanyDetail({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = use(params);
  const [p, setP] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");
  const [editOpen, setEditOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [jobOrderOpen, setJobOrderOpen] = useState(false);
  const [dealOpen, setDealOpen] = useState(false);
  const [submissionOpen, setSubmissionOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

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
            <div className="flex items-center gap-2">
              <button onClick={() => setAiOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/5 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10">
                <Sparkles className="h-3.5 w-3.5" /> Ask AI
              </button>
              <button onClick={() => setEditOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted">
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-1">
            {([["overview", "Overview"], ["contacts", `Contacts (${p.contacts.length})`], ["joborders", `Job Orders (${p.jobOrders.length})`], ["deals", `Deals (${p.deals.length})`], ["submissions", `Submitted (${p.submissions.length})`], ["activity", `Activity (${p.activities.length})`], ["tasks", `Tasks (${openTasks})`]] as [Tab, string][]).map(([k, lbl]) => (
              <button key={k} onClick={() => setTab(k)}
                className={cn("rounded-lg px-3 py-1.5 text-sm font-medium transition-colors", tab === k ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}>
                {lbl}
              </button>
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

        {tab === "joborders" && (
          <div>
            <div className="mb-3 flex justify-end">
              <button onClick={() => setJobOrderOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted">
                <Plus className="h-3.5 w-3.5" /> New job order
              </button>
            </div>
            {p.jobOrders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border py-14 text-center"><p className="text-sm text-muted-foreground">No job orders for this client yet.</p></div>
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
                {p.jobOrders.map((j) => (
                  <li key={j.id}>
                    <Link href={`/enterprise/crm/job-orders/${j.id}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-muted/20">
                      <span className="flex items-center gap-2 truncate"><StatusBadge value={j.status} styles={JOB_ORDER_STATUS_STYLES} /> {j.title}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{fmtMoney(j.placement_value)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === "deals" && (
          <div>
            <div className="mb-3 flex justify-end">
              <button onClick={() => setDealOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted">
                <Plus className="h-3.5 w-3.5" /> New deal
              </button>
            </div>
            {p.deals.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border py-14 text-center"><p className="text-sm text-muted-foreground">No deals for this client yet.</p></div>
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
                {p.deals.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <span className="flex items-center gap-2 truncate"><StatusBadge value={d.stage} styles={DEAL_STAGE_STYLES} /> {d.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{fmtMoney(d.value)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === "submissions" && (
          <div>
            <div className="mb-3 flex justify-end">
              <button onClick={() => setSubmissionOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted">
                <Plus className="h-3.5 w-3.5" /> Submit candidate
              </button>
            </div>
            {p.submissions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border py-14 text-center">
                <Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No candidates submitted to this client yet.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-border">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-muted/30 text-left text-xs text-muted-foreground">
                    <tr><th className="px-4 py-3 font-medium">Candidate</th><th className="hidden px-4 py-3 font-medium sm:table-cell">Job order</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Submitted</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {p.submissions.map((s) => (
                      <tr key={s.id} className="hover:bg-muted/20">
                        <td className="px-4 py-3 font-medium">{s.candidate_name}{s.candidate_email && <span className="ml-2 text-xs text-muted-foreground">{s.candidate_email}</span>}</td>
                        <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">{s.job_order ? <Link href={`/enterprise/crm/job-orders/${s.job_order.id}`} className="hover:text-primary">{s.job_order.title}</Link> : "—"}</td>
                        <td className="px-4 py-3"><StatusBadge value={s.status} styles={SUBMISSION_STATUS_STYLES} /></td>
                        <td className="px-4 py-3 text-muted-foreground">{fmtDate(s.submitted_at)}</td>
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
      <JobOrderForm open={jobOrderOpen} onClose={() => setJobOrderOpen(false)} companies={[{ id: c.id, name: c.name }]} defaultCompanyId={c.id} onSaved={() => load()} />
      <DealForm open={dealOpen} onClose={() => setDealOpen(false)} companies={[{ id: c.id, name: c.name }]} defaultCompanyId={c.id} onSaved={() => load()} />
      <SubmissionForm open={submissionOpen} onClose={() => setSubmissionOpen(false)} companyId={c.id} jobOrders={p.jobOrders.map((j) => ({ id: j.id, title: j.title }))} onSaved={() => load()} />
      <CrmAiModal open={aiOpen} onClose={() => setAiOpen(false)} companyId={c.id} companyName={c.name} />
    </main>
  );
}
