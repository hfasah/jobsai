"use client";

// Import target picker + duplicate-confirm flow for external results.
// Single import surfaces the dedup matches (skip / import anyway / merge);
// bulk import applies the chosen duplicate policy across the selection.
import { useEffect, useState } from "react";
import { Briefcase, Check, Coins, Contact, Database, Inbox, Loader2, Send, TriangleAlert, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DedupMatch } from "@/lib/sourcing/types";

type Target = "talent_pool" | "job" | "intake" | "crm_contact" | "campaign";

interface JobOption { id: string; title: string }
interface GroupOption { id: string; name: string }
interface CampaignOption { id: string; name: string; status: string }

export default function ImportDialog({
  resultIds,
  candidateName,
  lockedCampaign,
  revealNeeded = 0,
  revealCost = 2,
  onClose,
  onDone,
}: {
  resultIds: string[];
  candidateName?: string | null;
  // When set (from the campaign wizard's Audience step), the dialog skips the
  // target picker and enrolls straight into this campaign.
  lockedCampaign?: { id: string; name: string } | null;
  // How many of the selected candidates still need an email revealed, and the
  // per-reveal cost — so campaign/talent-pool enrolment can show ONE bundle
  // price up front instead of dripping charges one candidate at a time.
  revealNeeded?: number;
  revealCost?: number;
  onClose: () => void;
  onDone: (summary: string) => void;
}) {
  const single = resultIds.length === 1;
  const [target, setTarget] = useState<Target>(lockedCampaign ? "campaign" : "talent_pool");
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [jobId, setJobId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [campaignId, setCampaignId] = useState(lockedCampaign?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dupMatches, setDupMatches] = useState<DedupMatch[] | null>(null);

  useEffect(() => {
    fetch("/api/enterprise/jobs")
      .then((r) => r.json())
      .then((j) => {
        const list = (j.data ?? j.jobs ?? []) as { id: string; title: string }[];
        setJobs(list.map((x) => ({ id: x.id, title: x.title })));
      })
      .catch(() => {});
    fetch("/api/enterprise/talent-pool/groups")
      .then((r) => r.json())
      .then((j) => {
        const list = (j.data ?? j.groups ?? []) as { id: string; name: string }[];
        setGroups(list.map((x) => ({ id: x.id, name: x.name })));
      })
      .catch(() => {});
    fetch("/api/enterprise/campaigns")
      .then((r) => r.json())
      .then((j) => {
        const list = (j.data ?? j.campaigns ?? []) as { id: string; name: string; status: string }[];
        setCampaigns(list.map((x) => ({ id: x.id, name: x.name, status: x.status })));
      })
      .catch(() => {});
  }, []);

  const submit = async (onDuplicate: "skip" | "import_anyway" | "merge") => {
    setBusy(true);
    setError(null);
    try {
      // Campaign & talent-pool enrollment need a VERIFIED email. "Email available"
      // means the provider has one, not that it's revealed — so reveal any that
      // aren't yet (idempotent; only un-revealed candidates cost credits), then
      // enroll. Without this the enroll silently skips everyone as needs_email.
      let revealPrefix = "";
      if (target === "campaign" || target === "talent_pool") {
        const rev = await fetch("/api/enterprise/sourcing/bulk-reveal", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resultIds }),
        });
        const rj = await rev.json().catch(() => ({}));
        if (!rev.ok) { setError(rj.error ?? "Could not reveal emails."); return; }
        if (rj.data?.ran_out) { setError("Ran out of credits while revealing — top up and try again."); return; }
        if (rj.data?.revealed) revealPrefix = `Revealed ${rj.data.revealed} email${rj.data.revealed !== 1 ? "s" : ""}. `;
      }
      if (single) {
        const res = await fetch(`/api/enterprise/sourcing/results/${resultIds[0]}/import`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target, jobId: jobId || undefined, groupId: groupId || undefined, campaignId: campaignId || undefined, onDuplicate }),
        });
        const json = await res.json();
        if (res.status === 409 && json.needs_email) {
          setError("Reveal this candidate's email first — imports need a contact email.");
          return;
        }
        if (res.status === 409 && json.do_not_contact) {
          setError("This person is on your Do-Not-Contact list — can't enrol them.");
          return;
        }
        if (!res.ok) { setError(json.error ?? "Import failed."); return; }
        if (json.data.status === "duplicate_confirm") {
          setDupMatches(json.data.verdict?.matches ?? []);
          return;
        }
        if (json.data.status === "skipped") {
          setError(json.data.reason ?? "Skipped — not added.");
          return;
        }
        onDone(revealPrefix + (
          json.data.status === "merged"
            ? "Merged with an existing record."
            : target === "campaign"
              ? "Added to campaign — first email is queued."
              : target === "crm_contact"
                ? "Added to CRM contacts."
                : "Candidate imported."
        ));
      } else {
        const res = await fetch("/api/enterprise/sourcing/bulk-import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resultIds, target, jobId: jobId || undefined, groupId: groupId || undefined, campaignId: campaignId || undefined, onDuplicate }),
        });
        const json = await res.json();
        if (!res.ok) { setError(json.error ?? "Import failed."); return; }
        const s = json.data;
        const parts = [
          s.imported ? `${s.imported} imported` : null,
          s.merged ? `${s.merged} merged` : null,
          s.duplicates ? `${s.duplicates} duplicates skipped` : null,
          s.needs_email ? `${s.needs_email} need a revealed email` : null,
          s.do_not_contact ? `${s.do_not_contact} on do-not-contact` : null,
          s.skipped ? `${s.skipped} skipped` : null,
          s.errors ? `${s.errors} failed` : null,
        ].filter(Boolean);
        // Append the actual reasons (e.g. "Add a step to the campaign before
        // enrolling") so a "failed" count is never a dead end.
        const why = Array.isArray(s.reasons) && s.reasons.length ? ` — ${s.reasons.join("; ")}` : "";
        onDone(revealPrefix + (parts.join(", ") || "Nothing to import.") + why);
      }
    } catch {
      setError("Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const TARGETS: { key: Target; label: string; icon: typeof Users; desc: string }[] = [
    { key: "talent_pool", label: "Talent pool", icon: Users, desc: "Save for nurturing and future roles" },
    { key: "job", label: "A specific job", icon: Briefcase, desc: "Add to a job's pipeline as an applicant" },
    { key: "intake", label: "Intake pool", icon: Inbox, desc: "General Applications catch-all" },
    { key: "crm_contact", label: "CRM contact", icon: Contact, desc: "Add as a contact for relationship tracking" },
    { key: "campaign", label: "Cold-email campaign", icon: Send, desc: "Enroll in an outreach sequence" },
  ];

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold">
            {lockedCampaign ? <Send className="h-4 w-4 text-primary" /> : <Database className="h-4 w-4 text-primary" />}
            {lockedCampaign
              ? <>Add {single ? (candidateName ?? "candidate") : `${resultIds.length} candidates`} to campaign</>
              : <>Import {single ? (candidateName ?? "candidate") : `${resultIds.length} candidates`}</>}
          </h2>
          <button onClick={onClose} aria-label="Close"><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>

        {dupMatches ? (
          <div>
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-400">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">This candidate may already be in your system:</p>
                <ul className="mt-1 list-disc pl-4">
                  {dupMatches.slice(0, 4).map((m, i) => (
                    <li key={i}>
                      {m.label ?? "Record"} — {m.type.replace("_", " ")} (matched on {m.matched_on.replace("_", " + ")})
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={onClose} disabled={busy}
                className="rounded-xl border border-border py-2 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-60">
                Skip
              </button>
              <button onClick={() => submit("merge")} disabled={busy}
                className="rounded-xl border border-primary/40 py-2 text-xs font-medium text-primary disabled:opacity-60">
                Merge (fill blanks)
              </button>
              <button onClick={() => submit("import_anyway")} disabled={busy}
                className="btn-cta rounded-xl py-2 text-xs font-semibold disabled:opacity-60">
                Import anyway
              </button>
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              Merge never overwrites recruiter notes or application history — it only fills empty fields.
            </p>
          </div>
        ) : (
          <>
            {lockedCampaign && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/5 px-3 py-2.5 text-sm">
                <Send className="h-4 w-4 shrink-0 text-primary" />
                <span>Enrolling into <span className="font-medium">{lockedCampaign.name}</span></span>
              </div>
            )}
            {!lockedCampaign && (
            <div className="mb-4 space-y-2">
              {TARGETS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTarget(t.key)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                    target === t.key ? "border-primary/60 bg-primary/5" : "border-border hover:border-border/80",
                  )}
                >
                  <t.icon className={cn("h-4 w-4", target === t.key ? "text-primary" : "text-muted-foreground")} />
                  <span className="flex-1">
                    <span className="block text-sm font-medium">{t.label}</span>
                    <span className="block text-[11px] text-muted-foreground">{t.desc}</span>
                  </span>
                  {target === t.key && <Check className="h-4 w-4 text-primary" />}
                </button>
              ))}
            </div>
            )}

            {target === "job" && (
              <label className="mb-4 block text-xs">
                <span className="mb-1 block font-semibold uppercase tracking-wide text-muted-foreground">Job</span>
                <select
                  value={jobId}
                  onChange={(e) => setJobId(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Select a job…</option>
                  {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
                </select>
              </label>
            )}

            {target === "talent_pool" && groups.length > 0 && (
              <label className="mb-4 block text-xs">
                <span className="mb-1 block font-semibold uppercase tracking-wide text-muted-foreground">Pool group (optional)</span>
                <select
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">No group</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </label>
            )}

            {target === "campaign" && !lockedCampaign && (
              <label className="mb-4 block text-xs">
                <span className="mb-1 block font-semibold uppercase tracking-wide text-muted-foreground">Campaign</span>
                <select
                  value={campaignId}
                  onChange={(e) => setCampaignId(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Select a campaign…</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}{c.status && c.status !== "active" ? ` (${c.status})` : ""}
                    </option>
                  ))}
                </select>
                {campaigns.length === 0 && (
                  <span className="mt-1 block text-[10px] text-muted-foreground">
                    No campaigns yet — create one under Outreach first.
                  </span>
                )}
              </label>
            )}

            {error && (
              <div className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                <div className="flex items-center gap-2"><TriangleAlert className="h-3.5 w-3.5 shrink-0" /> {error}</div>
                {/credit|top up/i.test(error) && (
                  <a href="/enterprise/sourcing/credits" className="mt-2 flex items-center justify-center gap-1 rounded-lg border border-primary/40 py-1.5 text-[11px] font-semibold text-primary hover:bg-primary/10">
                    <Coins className="h-3 w-3" /> Top up credits →
                  </a>
                )}
              </div>
            )}

            {(() => {
              const needsReveal = (target === "campaign" || target === "talent_pool") && revealNeeded > 0;
              const bundleCost = revealNeeded * revealCost;
              return (
                <>
                  {needsReveal && (
                    <div className="mb-2 flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
                      <span className="text-muted-foreground">Reveal {revealNeeded} contact{revealNeeded !== 1 ? "s" : ""} (bundle)</span>
                      <span className="font-semibold text-primary">{bundleCost} credit{bundleCost !== 1 ? "s" : ""}</span>
                    </div>
                  )}
                  <button
                    onClick={() => submit("skip")}
                    disabled={busy || (target === "job" && !jobId) || (target === "campaign" && !campaignId)}
                    className="btn-cta inline-flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold disabled:opacity-60"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : target === "campaign" ? <Send className="h-4 w-4" /> : <Database className="h-4 w-4" />}
                    {busy
                      ? target === "campaign" ? "Revealing & enrolling…" : "Importing…"
                      : target === "campaign"
                        ? needsReveal
                          ? `Unlock & enroll ${resultIds.length} · ${bundleCost} credits`
                          : single ? "Add to campaign" : `Enroll ${resultIds.length} in campaign`
                        : target === "talent_pool" && needsReveal
                          ? `Unlock & save ${resultIds.length} · ${bundleCost} credits`
                          : single ? "Import candidate" : `Import ${resultIds.length} candidates`}
                  </button>
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    {needsReveal
                      ? `${revealNeeded} of these need an email revealed — done in one bundle (${bundleCost} credits total), not one at a time. Already-revealed candidates cost nothing. Duplicates are flagged first.`
                      : target === "campaign" || target === "talent_pool"
                        ? "All selected already have a revealed email. Duplicates are flagged before anything is overwritten."
                        : "Duplicates are detected first — you'll be asked before anything is overwritten."}
                  </p>
                </>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}
