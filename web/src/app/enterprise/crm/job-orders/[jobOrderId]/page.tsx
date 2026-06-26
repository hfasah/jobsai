"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ArrowLeft, Pencil, Building2, ExternalLink, Briefcase, Users, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { labelFor, type CrmJobOrder, type CrmActivity, type CrmTask, type CrmSubmission } from "@/lib/crm-shared";
import { JobOrderForm } from "@/components/enterprise/crm/job-order-form";
import { SubmissionForm } from "@/components/enterprise/crm/submission-form";
import { ActivityTimeline, TasksPanel } from "@/components/enterprise/crm/activity-log";
import { fmtDate, fmtMoney, JOB_ORDER_STATUS_STYLES, PRIORITY_STYLES, SUBMISSION_STATUS_STYLES, StatusBadge } from "@/components/enterprise/crm/crm-ui";

type Row = CrmJobOrder & {
  company?: { id: string; name: string } | null;
  contact?: { id: string; first_name: string; last_name: string | null } | null;
  deal?: { id: string; name: string; stage: string } | null;
};
interface Payload { data: Row; linkedJob: { id: string; title: string; status: string; candidate_count: number } | null; activities: CrmActivity[]; tasks: CrmTask[]; submissions: CrmSubmission[] }
type Tab = "overview" | "candidates" | "activity" | "tasks";

export default function JobOrderDetail({ params }: { params: Promise<{ jobOrderId: string }> }) {
  const { jobOrderId } = use(params);
  const [p, setP] = useState<Payload | null>(null);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");
  const [editOpen, setEditOpen] = useState(false);
  const [submissionOpen, setSubmissionOpen] = useState(false);
  const [linking, setLinking] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/enterprise/crm/job-orders/${jobOrderId}`).then((r) => (r.ok ? r.json() : null)).then(setP).finally(() => setLoading(false));
  }, [jobOrderId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetch("/api/enterprise/crm/companies").then((r) => r.json()).then((j) => setCompanies((j.data ?? []).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })))); }, []);

  // Spin up a real ATS posting from this order and link it, so the existing
  // candidate/pipeline/interview/offer flow applies.
  const createPosting = async () => {
    if (!p) return;
    setLinking(true);
    try {
      const res = await fetch("/api/enterprise/jobs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: p.data.title, location: p.data.location ?? undefined, description: p.data.description ?? undefined, status: "draft" }),
      });
      const json = await res.json();
      if (res.ok && json.data?.id) {
        await fetch(`/api/enterprise/crm/job-orders/${jobOrderId}`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ job_id: json.data.id }),
        });
        load();
      }
    } finally { setLinking(false); }
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!p) return <div className="px-6 py-20 text-center text-sm text-muted-foreground">Job order not found.</div>;
  const o = p.data;
  const openTasks = p.tasks.filter((t) => t.status === "open").length;
  const money: [string, number | null][] = [["Pay rate", o.pay_rate], ["Bill rate", o.bill_rate], ["Placement value", o.placement_value]];

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="border-b border-border bg-card px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <Link href="/enterprise/crm/job-orders" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Job Orders
          </Link>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl font-bold">{o.title}</h1>
                <StatusBadge value={o.status} styles={JOB_ORDER_STATUS_STYLES} />
                <StatusBadge value={o.priority} styles={PRIORITY_STYLES} />
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {o.company && <Link href={`/enterprise/crm/companies/${o.company.id}`} className="inline-flex items-center gap-1 hover:text-primary"><Building2 className="h-3 w-3" />{o.company.name}</Link>}
                <span>{labelFor(o.job_type)}</span>
                {o.location && <span>{o.location}{o.work_mode ? ` · ${labelFor(o.work_mode)}` : ""}</span>}
                <span>{o.openings} opening{o.openings === 1 ? "" : "s"}</span>
              </div>
            </div>
            <button onClick={() => setEditOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted">
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-1">
            {([["overview", "Overview"], ["candidates", `Candidates (${p.submissions.length})`], ["activity", `Activity (${p.activities.length})`], ["tasks", `Tasks (${openTasks})`]] as [Tab, string][]).map(([k, lbl]) => (
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
                <h2 className="mb-3 text-sm font-semibold">Commercials</h2>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
                  {money.map(([k, v]) => <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="mt-0.5 font-medium">{fmtMoney(v)}</dd></div>)}
                  <div><dt className="text-xs text-muted-foreground">Fee %</dt><dd className="mt-0.5 font-medium">{o.fee_pct != null ? `${o.fee_pct}%` : "—"}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Markup %</dt><dd className="mt-0.5 font-medium">{o.markup != null ? `${o.markup}%` : "—"}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Salary</dt><dd className="mt-0.5 font-medium">{o.salary_min || o.salary_max ? `${fmtMoney(o.salary_min)}–${fmtMoney(o.salary_max)}` : "—"}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Expected close</dt><dd className="mt-0.5 font-medium">{o.expected_close_at ? fmtDate(o.expected_close_at) : "—"}</dd></div>
                </dl>
              </div>
              {o.description && <div className="rounded-2xl border border-border bg-card p-5"><h2 className="mb-2 text-sm font-semibold">Description</h2><p className="whitespace-pre-wrap text-sm text-muted-foreground">{o.description}</p></div>}
              {o.internal_notes && <div className="rounded-2xl border border-border bg-card p-5"><h2 className="mb-2 text-sm font-semibold">Internal notes</h2><p className="whitespace-pre-wrap text-sm text-muted-foreground">{o.internal_notes}</p></div>}
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold"><Briefcase className="h-4 w-4" /> Linked posting</h2>
              {p.linkedJob ? (
                <div className="space-y-2 text-sm">
                  <Link href={`/enterprise/jobs/${p.linkedJob.id}`} className="font-medium hover:text-primary">{p.linkedJob.title}</Link>
                  <p className="text-xs text-muted-foreground">Status: {labelFor(p.linkedJob.status)}</p>
                  <p className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Users className="h-3 w-3" /> {p.linkedJob.candidate_count} candidate{p.linkedJob.candidate_count === 1 ? "" : "s"}</p>
                  <Link href={`/enterprise/jobs/${p.linkedJob.id}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">Open in ATS <ExternalLink className="h-3 w-3" /></Link>
                </div>
              ) : (
                <div>
                  <p className="mb-3 text-xs text-muted-foreground">Create a job posting from this order to source candidates and run the full pipeline.</p>
                  <button onClick={createPosting} disabled={linking} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-60">
                    {linking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Create posting
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        {tab === "candidates" && (
          <div>
            <div className="mb-3 flex justify-end">
              <button onClick={() => setSubmissionOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted">
                <Plus className="h-3.5 w-3.5" /> Submit candidate
              </button>
            </div>
            {p.submissions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border py-14 text-center">
                <Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No candidates submitted for this order yet.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-border">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-muted/30 text-left text-xs text-muted-foreground">
                    <tr><th className="px-4 py-3 font-medium">Candidate</th><th className="hidden px-4 py-3 font-medium sm:table-cell">Email</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Submitted</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {p.submissions.map((s) => (
                      <tr key={s.id} className="hover:bg-muted/20">
                        <td className="px-4 py-3 font-medium">{s.candidate_name}</td>
                        <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">{s.candidate_email ?? "—"}</td>
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
        {tab === "activity" && <ActivityTimeline scope={{ company_id: o.company_id, job_order_id: jobOrderId }} activities={p.activities} onChanged={load} />}
        {tab === "tasks" && <TasksPanel scope={{ company_id: o.company_id, job_order_id: jobOrderId }} tasks={p.tasks} onChanged={load} />}
      </div>

      <JobOrderForm open={editOpen} onClose={() => setEditOpen(false)} jobOrder={o} companies={companies} onSaved={() => load()} />
      <SubmissionForm open={submissionOpen} onClose={() => setSubmissionOpen(false)} companyId={o.company_id} jobOrders={[{ id: o.id, title: o.title }]} defaultJobOrderId={o.id} defaultContactId={o.contact_id ?? undefined} onSaved={() => load()} />
    </main>
  );
}
