"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Loader2, Shield, FileText, Trash2, CheckCircle2, Clock, AlertTriangle,
  Download, Plus, X, Search, Archive, ChevronDown, ChevronUp, Lock, Unlock,
  RefreshCw, Database, Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface ComplianceRequest {
  id: string; request_type: "access" | "erasure" | "portability";
  candidate_email: string; candidate_name: string | null;
  status: "pending" | "in_progress" | "completed" | "rejected";
  notes: string | null; requested_at: string; resolved_at: string | null;
}
interface RetentionSettings {
  data_retention_days: number | null; retention_action: "anonymize" | "delete"; affected_count: number;
}
interface AuditLog {
  id: string; user_id: string | null; action: string; resource_type: string | null;
  resource_id: string | null; metadata: Record<string, unknown>; ip_address: string | null;
  created_at: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const REQUEST_TYPES = [
  { value: "access",      label: "Data access",      description: "Export all personal data held",   color: "text-blue-400",   bg: "bg-blue-400/10" },
  { value: "erasure",     label: "Erasure (right to be forgotten)", description: "Anonymize all personal data", color: "text-red-400", bg: "bg-red-400/10" },
  { value: "portability", label: "Data portability", description: "Export data in machine-readable format", color: "text-purple-400", bg: "bg-purple-400/10" },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending:     { label: "Pending",     color: "text-amber-400",   icon: Clock },
  in_progress: { label: "In progress", color: "text-blue-400",    icon: RefreshCw },
  completed:   { label: "Completed",   color: "text-green-400",   icon: CheckCircle2 },
  rejected:    { label: "Rejected",    color: "text-rose-400",    icon: X },
};

const RETENTION_OPTIONS = [
  { value: 30,  label: "30 days" },
  { value: 60,  label: "60 days" },
  { value: 90,  label: "90 days" },
  { value: 180, label: "6 months" },
  { value: 365, label: "1 year" },
];

// ── Components ────────────────────────────────────────────────────────────────
function NewRequestModal({ onSave, onClose }: {
  onSave: (data: { request_type: string; candidate_email: string; candidate_name: string; notes: string }) => Promise<void>;
  onClose: () => void;
}) {
  const [type, setType] = useState("access");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!email.trim()) return;
    setSaving(true);
    await onSave({ request_type: type, candidate_email: email.trim(), candidate_name: name.trim(), notes: notes.trim() });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="flex items-center gap-2 font-semibold"><Shield className="h-4 w-4 text-primary" />New compliance request</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium">Request type</label>
            <div className="space-y-2">
              {REQUEST_TYPES.map((rt) => (
                <button key={rt.value} onClick={() => setType(rt.value)}
                  className={cn("w-full flex items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                    type === rt.value ? "border-primary bg-primary/5" : "border-border hover:bg-muted")}>
                  <span className={cn("mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-offset-2 ring-offset-card", type === rt.value ? "bg-primary ring-primary" : "bg-muted-foreground/30 ring-transparent")} />
                  <div>
                    <p className="text-sm font-medium">{rt.label}</p>
                    <p className="text-xs text-muted-foreground">{rt.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Candidate email <span className="text-destructive">*</span></label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email"
              placeholder="candidate@example.com"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Candidate name <span className="text-xs text-muted-foreground">(optional)</span></label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Notes <span className="text-xs text-muted-foreground">(optional)</span></label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              placeholder="Reference number, internal notes..."
              className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
        </div>
        <div className="border-t border-border px-5 py-4">
          <button onClick={submit} disabled={!email.trim() || saving}
            className="btn-cta inline-flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create request
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CompliancePage() {
  const [requests, setRequests] = useState<ComplianceRequest[]>([]);
  const [retention, setRetention] = useState<RetentionSettings | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"requests" | "retention" | "audit">("requests");
  const [modalOpen, setModalOpen] = useState(false);
  const [fulfilling, setFulfilling] = useState<string | null>(null);
  const [auditSearch, setAuditSearch] = useState("");
  const [retentionDays, setRetentionDays] = useState<number | null>(null);
  const [retentionAction, setRetentionAction] = useState<"anonymize" | "delete">("anonymize");
  const [savingRetention, setSavingRetention] = useState(false);
  const [exportData, setExportData] = useState<string | null>(null);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    const [reqRes, retRes, auditRes] = await Promise.all([
      fetch("/api/enterprise/compliance/requests").then((r) => r.json()),
      fetch("/api/enterprise/compliance/retention").then((r) => r.json()),
      fetch("/api/enterprise/audit-logs?limit=100").then((r) => r.json()),
    ]);
    setRequests(reqRes.data ?? []);
    if (retRes && !retRes.error) {
      setRetention(retRes);
      setRetentionDays(retRes.data_retention_days);
      setRetentionAction(retRes.retention_action ?? "anonymize");
    }
    setAuditLogs(auditRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const createRequest = async (data: { request_type: string; candidate_email: string; candidate_name: string; notes: string }) => {
    await fetch("/api/enterprise/compliance/requests", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setModalOpen(false);
    await load();
  };

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/enterprise/compliance/requests/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await load();
  };

  const fulfill = async (request: ComplianceRequest) => {
    setFulfilling(request.id);
    try {
      const res = await fetch(`/api/enterprise/compliance/requests/${request.id}/fulfill`, {
        method: "POST",
      });
      const json = await res.json();
      if (request.request_type === "access" || request.request_type === "portability") {
        const blob = new Blob([JSON.stringify(json.data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        setExportData(url);
      }
      await load();
    } finally {
      setFulfilling(null);
    }
  };

  const saveRetention = async () => {
    setSavingRetention(true);
    await fetch("/api/enterprise/compliance/retention", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data_retention_days: retentionDays, retention_action: retentionAction }),
    });
    setSavingRetention(false);
    await load();
  };

  const pendingCount = requests.filter((r) => r.status === "pending" || r.status === "in_progress").length;
  const filteredLogs = auditLogs.filter((l) =>
    !auditSearch || l.action.includes(auditSearch) || (l.resource_type ?? "").includes(auditSearch)
  );

  const exportAuditCsv = () => {
    const headers = ["date", "action", "resource_type", "resource_id", "user_id"].join(",");
    const rows = filteredLogs.map((l) =>
      [l.created_at, l.action, l.resource_type ?? "", l.resource_id ?? "", l.user_id ?? ""].join(",")
    );
    const blob = new Blob([[headers, ...rows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "audit-log.csv"; a.click();
  };

  if (loading) return (
    <main className="flex flex-1 items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </main>
  );

  return (
    <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-6">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <Shield className="h-6 w-6 text-primary" />
              Compliance & Governance
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">GDPR requests, data retention, legal hold, and audit log.</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Open requests",    value: pendingCount,   icon: FileText, color: pendingCount > 0 ? "text-amber-400" : "text-muted-foreground" },
            { label: "Retention policy", value: retention?.data_retention_days ? `${retention.data_retention_days}d` : "Off", icon: Database, color: retention?.data_retention_days ? "text-green-400" : "text-muted-foreground" },
            { label: "Affected records", value: retention?.affected_count ?? 0, icon: Archive, color: (retention?.affected_count ?? 0) > 0 ? "text-amber-400" : "text-muted-foreground" },
            { label: "Total requests",   value: requests.length, icon: Shield, color: "text-primary" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-2">
                <Icon className={cn("h-4 w-4", color)} />
                <p className="text-sm text-muted-foreground">{label}</p>
              </div>
              <p className="text-2xl font-bold tabular-nums">{value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
          {([
            { key: "requests",  label: `GDPR Requests (${requests.length})` },
            { key: "retention", label: "Retention Policy" },
            { key: "audit",     label: `Audit Log (${auditLogs.length})` },
          ] as const).map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key)}
              className={cn("flex-1 rounded-lg py-1.5 text-sm font-medium transition-colors",
                tab === key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}>
              {label}
            </button>
          ))}
        </div>

        {/* GDPR Requests */}
        {tab === "requests" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Track and fulfill data subject access, erasure, and portability requests.</p>
              <button onClick={() => setModalOpen(true)}
                className="btn-cta inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold">
                <Plus className="h-4 w-4" /> New request
              </button>
            </div>

            {requests.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-12 text-center">
                <Shield className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
                <p className="font-medium">No compliance requests</p>
                <p className="mt-1 text-sm text-muted-foreground">Requests from candidates for data access or deletion will appear here.</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-muted/30">
                    <tr>
                      {["Candidate", "Type", "Status", "Requested", "Actions"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {requests.map((req) => {
                      const st = STATUS_CONFIG[req.status];
                      const StatusIcon = st.icon;
                      const rt = REQUEST_TYPES.find((r) => r.value === req.request_type);
                      const canFulfill = req.status === "pending" || req.status === "in_progress";
                      return (
                        <tr key={req.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-medium">{req.candidate_name || req.candidate_email}</p>
                            {req.candidate_name && <p className="text-xs text-muted-foreground">{req.candidate_email}</p>}
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", rt?.bg, rt?.color)}>
                              {rt?.label ?? req.request_type}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn("flex items-center gap-1 text-xs font-medium", st.color)}>
                              <StatusIcon className="h-3 w-3" />
                              {st.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {new Date(req.requested_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {canFulfill && (
                                <button onClick={() => fulfill(req)}
                                  disabled={fulfilling === req.id}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted transition-colors disabled:opacity-60">
                                  {fulfilling === req.id
                                    ? <Loader2 className="h-3 w-3 animate-spin" />
                                    : req.request_type === "erasure" ? <Trash2 className="h-3 w-3 text-rose-400" /> : <Eye className="h-3 w-3 text-blue-400" />}
                                  Fulfill
                                </button>
                              )}
                              {canFulfill && (
                                <button onClick={() => updateStatus(req.id, "rejected")}
                                  className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                                  Reject
                                </button>
                              )}
                              {req.status === "pending" && (
                                <button onClick={() => updateStatus(req.id, "in_progress")}
                                  className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                                  Mark in progress
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Export download link */}
            {exportData && (
              <div className="flex items-center gap-3 rounded-xl border border-green-500/30 bg-green-500/10 p-4">
                <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-400">Access export ready</p>
                  <p className="text-xs text-muted-foreground">Candidate data exported. Download and send to the requestor.</p>
                </div>
                <a href={exportData} download="candidate-data-export.json"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-green-500/20 px-3 py-1.5 text-xs font-medium text-green-400 hover:bg-green-500/30 transition-colors">
                  <Download className="h-3.5 w-3.5" /> Download JSON
                </a>
                <button onClick={() => setExportData(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
              </div>
            )}
          </div>
        )}

        {/* Retention Policy */}
        {tab === "retention" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6 space-y-6">
              <div>
                <h2 className="font-semibold mb-1">Data retention policy</h2>
                <p className="text-sm text-muted-foreground">Automatically anonymize or delete rejected candidate data after a set period. Runs daily at midnight. Legal holds are always respected.</p>
              </div>

              {/* Retention period */}
              <div>
                <label className="mb-3 block text-sm font-medium">Retention period for rejected applications</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setRetentionDays(null)}
                    className={cn("rounded-xl border px-4 py-2 text-sm font-medium transition-colors",
                      retentionDays === null ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted hover:text-foreground")}>
                    Indefinite (off)
                  </button>
                  {RETENTION_OPTIONS.map((opt) => (
                    <button key={opt.value}
                      onClick={() => setRetentionDays(opt.value)}
                      className={cn("rounded-xl border px-4 py-2 text-sm font-medium transition-colors",
                        retentionDays === opt.value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted hover:text-foreground")}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Retention action */}
              {retentionDays !== null && (
                <div>
                  <label className="mb-3 block text-sm font-medium">When retention period expires</label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {([
                      { value: "anonymize", label: "Anonymize", desc: "Replace PII with [deleted]. Row is retained for analytics.", icon: Lock },
                      { value: "delete",    label: "Hard delete", desc: "Permanently delete the application record.", icon: Trash2 },
                    ] as const).map(({ value, label, desc, icon: Icon }) => (
                      <button key={value} onClick={() => setRetentionAction(value)}
                        className={cn("flex items-start gap-3 rounded-xl border p-4 text-left transition-colors",
                          retentionAction === value ? "border-primary bg-primary/5" : "border-border hover:bg-muted")}>
                        <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", retentionAction === value ? "text-primary" : "text-muted-foreground")} />
                        <div>
                          <p className="text-sm font-medium">{label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview */}
              {retention && retentionDays !== null && retention.data_retention_days === retentionDays && (
                <div className={cn(
                  "flex items-center gap-3 rounded-xl border p-4",
                  (retention.affected_count ?? 0) > 0 ? "border-amber-500/30 bg-amber-500/10" : "border-green-500/30 bg-green-500/10"
                )}>
                  {(retention.affected_count ?? 0) > 0
                    ? <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                    : <CheckCircle2 className="h-4 w-4 shrink-0 text-green-400" />}
                  <p className="text-sm">
                    {(retention.affected_count ?? 0) > 0
                      ? <><span className="font-semibold text-amber-400">{retention.affected_count}</span> rejected application{retention.affected_count !== 1 ? "s" : ""} are currently past the retention window and will be {retentionAction === "delete" ? "deleted" : "anonymized"} at the next cron run.</>
                      : "No applications are currently past the retention window."}
                  </p>
                </div>
              )}

              <div className="flex justify-end">
                <button onClick={saveRetention} disabled={savingRetention}
                  className="btn-cta inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold disabled:opacity-60">
                  {savingRetention ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Save policy
                </button>
              </div>
            </div>

            {/* Legal hold info */}
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/10">
                  <Lock className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <h2 className="font-semibold">Legal hold</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Individual applications can be placed on legal hold from the candidate profile. Records under legal hold are excluded from all retention enforcement and erasure requests until the hold is lifted. Use this for active litigation or regulatory investigations.
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">To set a legal hold: open any application → Actions menu → Toggle legal hold.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Audit Log */}
        {tab === "audit" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-1 min-w-48 items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input value={auditSearch} onChange={(e) => setAuditSearch(e.target.value)}
                  placeholder="Filter by action or resource..."
                  className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none" />
              </div>
              <button onClick={exportAuditCsv}
                className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                <Download className="h-4 w-4" /> Export CSV
              </button>
            </div>

            {filteredLogs.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No audit events found.</p>
            ) : (
              <div className="space-y-1.5">
                {filteredLogs.map((log) => {
                  const expanded = expandedLogs.has(log.id);
                  const hasMetadata = log.metadata && Object.keys(log.metadata).length > 0;
                  return (
                    <div key={log.id} className="rounded-xl border border-border bg-card">
                      <div className="flex items-center gap-3 px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <code className="text-xs font-mono text-primary">{log.action}</code>
                            {log.resource_type && (
                              <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                                {log.resource_type}
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {log.user_id ? `User ${log.user_id.slice(0, 12)}…` : "System"}
                            {log.ip_address && ` · ${log.ip_address}`}
                          </p>
                        </div>
                        <p className="shrink-0 text-xs text-muted-foreground">
                          {new Date(log.created_at).toLocaleString()}
                        </p>
                        {hasMetadata && (
                          <button onClick={() => setExpandedLogs((s) => {
                            const n = new Set(s); n.has(log.id) ? n.delete(log.id) : n.add(log.id); return n;
                          })} className="text-muted-foreground hover:text-foreground">
                            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          </button>
                        )}
                      </div>
                      {expanded && hasMetadata && (
                        <div className="border-t border-border px-4 py-2.5">
                          <pre className="text-[11px] text-muted-foreground overflow-x-auto">{JSON.stringify(log.metadata, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {modalOpen && (
        <NewRequestModal onSave={createRequest} onClose={() => setModalOpen(false)} />
      )}
    </main>
  );
}
