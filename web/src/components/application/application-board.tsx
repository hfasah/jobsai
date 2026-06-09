"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Loader2, Plus, Zap, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ApplicationCard } from "@/components/application/application-card";
import { AddJobPicker } from "@/components/application/add-job-picker";
import {
  APPLICATION_STAGES,
  STAGE_LABELS,
  type Application,
  type ApplicationStage,
  type UpdateApplicationBody,
} from "@/types/application";

const STAGE_ACCENT: Record<ApplicationStage, string> = {
  saved: "border-t-slate-400",
  applied: "border-t-blue-500",
  interviewing: "border-t-amber-500",
  offer: "border-t-green-500",
  rejected: "border-t-red-400",
};

type ApplyStatus = "idle" | "running" | "done";
interface JobApplyState { status: ApplyStatus }

export function ApplicationBoard() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<ApplicationStage | null>(null);

  // Selection state (only for saved cards)
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  // Per-job apply state
  const [applyStates, setApplyStates] = useState<Record<string, JobApplyState>>({});
  const [bulkRunning, setBulkRunning] = useState(false);

  const fetchApplications = useCallback(async () => {
    const res = await fetch("/api/applications");
    const json = await res.json();
    if (json.data) setApplications(json.data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchApplications(); }, [fetchApplications]);

  const byStage = useMemo(() => {
    const map: Record<ApplicationStage, Application[]> = {
      saved: [], applied: [], interviewing: [], offer: [], rejected: [],
    };
    for (const a of applications) map[a.stage]?.push(a);
    return map;
  }, [applications]);

  const trackedJobIds = useMemo(() => new Set(applications.map((a) => a.job_id)), [applications]);
  const savedJobIds = useMemo(() => byStage.saved.map((a) => a.job_id), [byStage]);
  const allSavedSelected = savedJobIds.length > 0 && savedJobIds.every((id) => selectedJobIds.has(id));

  const toggleSelectAll = () => {
    if (allSavedSelected) {
      setSelectedJobIds(new Set());
    } else {
      setSelectedJobIds(new Set(savedJobIds));
    }
  };

  const toggleSelect = (jobId: string, checked: boolean) => {
    setSelectedJobIds((prev) => {
      const next = new Set(prev);
      checked ? next.add(jobId) : next.delete(jobId);
      return next;
    });
  };

  // Apply a single job via Skyvern agent
  const applyOne = useCallback(async (jobId: string) => {
    setApplyStates((p) => ({ ...p, [jobId]: { status: "running" } }));
    try {
      const res = await fetch(`/api/jobs/${jobId}/agent-apply`, { method: "POST" });
      const json = await res.json();
      setApplyStates((p) => ({ ...p, [jobId]: { status: res.ok ? "done" : "idle" } }));
      if (res.ok) {
        // Optimistically move to applied
        setApplications((prev) =>
          prev.map((a) => a.job_id === jobId ? { ...a, stage: "applied" as ApplicationStage } : a)
        );
        setSelectedJobIds((prev) => { const next = new Set(prev); next.delete(jobId); return next; });
      } else {
        alert(json.error ?? "Agent apply failed.");
      }
    } catch {
      setApplyStates((p) => ({ ...p, [jobId]: { status: "idle" } }));
    }
  }, []);

  // Bulk apply — runs sequentially to avoid hammering the API
  const applySelected = useCallback(async () => {
    if (bulkRunning || selectedJobIds.size === 0) return;
    setBulkRunning(true);
    for (const jobId of Array.from(selectedJobIds)) {
      await applyOne(jobId);
    }
    setBulkRunning(false);
  }, [bulkRunning, selectedJobIds, applyOne]);

  const updateApplication = useCallback(
    async (id: string, body: UpdateApplicationBody) => {
      setApplications((prev) => prev.map((a) => (a.id === id ? { ...a, ...body } as Application : a)));
      const res = await fetch(`/api/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const json = await res.json();
        setApplications((prev) => prev.map((a) => (a.id === id ? { ...a, ...json.data } : a)));
      } else {
        fetchApplications();
      }
    },
    [fetchApplications]
  );

  const deleteApplication = useCallback(async (id: string) => {
    if (!confirm("Remove this job from your tracker?")) return;
    setApplications((prev) => prev.filter((a) => a.id !== id));
    await fetch(`/api/applications/${id}`, { method: "DELETE" });
  }, []);

  const addApplication = useCallback(async (jobId: string) => {
    const res = await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_id: jobId }),
    });
    const json = await res.json();
    if (json.data) await fetchApplications();
  }, [fetchApplications]);

  const handleDrop = useCallback((stage: ApplicationStage) => {
    setDragOverStage(null);
    const id = draggingId;
    setDraggingId(null);
    if (!id) return;
    const card = applications.find((a) => a.id === id);
    if (!card || card.stage === stage) return;
    updateApplication(id, { stage });
  }, [draggingId, applications, updateApplication]);

  const appliedCount = Object.values(applyStates).filter((s) => s.status === "done").length;
  const runningCount = Object.values(applyStates).filter((s) => s.status === "running").length;

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading your pipeline…
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-end">
        <Button onClick={() => setPickerOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add job
        </Button>
      </div>

      {applications.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">No applications tracked yet.</p>
          <Button className="mt-4" onClick={() => setPickerOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add your first job
          </Button>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {APPLICATION_STAGES.map((stage) => {
            const cards = byStage[stage];
            const isSaved = stage === "saved";

            return (
              <div
                key={stage}
                onDragOver={(e) => { e.preventDefault(); if (dragOverStage !== stage) setDragOverStage(stage); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverStage((s) => (s === stage ? null : s)); }}
                onDrop={() => handleDrop(stage)}
                className={cn(
                  "flex flex-col rounded-xl border border-t-4 border-border bg-muted/30 p-3 transition-colors",
                  STAGE_ACCENT[stage],
                  dragOverStage === stage && "bg-primary/5 ring-2 ring-primary/30"
                )}
              >
                {/* Column header */}
                <div className="mb-3 flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold">{STAGE_LABELS[stage]}</h2>
                    <span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {cards.length}
                    </span>
                  </div>
                  {isSaved && cards.length > 0 && (
                    <button
                      onClick={toggleSelectAll}
                      className="text-[11px] font-medium text-primary hover:underline"
                    >
                      {allSavedSelected ? "Deselect all" : "Select all"}
                    </button>
                  )}
                </div>

                <div className="flex min-h-[60px] flex-col gap-2.5">
                  {cards.map((a) => {
                    const jobApply = applyStates[a.job_id];
                    return (
                      <ApplicationCard
                        key={a.id}
                        application={a}
                        onUpdate={updateApplication}
                        onDelete={deleteApplication}
                        onDragStart={setDraggingId}
                        dragging={draggingId === a.id}
                        selectable={isSaved}
                        selected={selectedJobIds.has(a.job_id)}
                        onSelect={isSaved ? toggleSelect : undefined}
                        applying={jobApply?.status === "running"}
                        applied={jobApply?.status === "done"}
                        onApply={isSaved ? applyOne : undefined}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sticky bulk-apply bar — appears when jobs are selected */}
      {selectedJobIds.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur md:left-60">
          <div className="mx-auto flex w-full max-w-4xl items-center gap-3 px-4 py-3 sm:px-6">
            {/* Progress line */}
            {(bulkRunning || appliedCount > 0) && (
              <div className="hidden items-center gap-2 text-xs sm:flex">
                {runningCount > 0 && (
                  <span className="flex items-center gap-1.5 text-primary">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Applying {runningCount}…
                  </span>
                )}
                {appliedCount > 0 && (
                  <span className="flex items-center gap-1.5 text-desyn-success">
                    <CheckCircle2 className="h-3.5 w-3.5" /> {appliedCount} submitted
                  </span>
                )}
              </div>
            )}

            <span className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium">
              {selectedJobIds.size} job{selectedJobIds.size !== 1 ? "s" : ""} selected
            </span>

            <button
              onClick={() => setSelectedJobIds(new Set())}
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="ml-auto flex items-center gap-2">
              <p className="hidden text-xs text-muted-foreground sm:block">
                Agent opens each site, fills the form &amp; submits — no manual work needed
              </p>
              <button
                onClick={applySelected}
                disabled={bulkRunning}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#f5c518] px-4 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {bulkRunning
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Working…</>
                  : <><Zap className="h-4 w-4" /> Agent Apply to All ({selectedJobIds.size})</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {pickerOpen && (
        <AddJobPicker
          trackedJobIds={trackedJobIds}
          onAdd={addApplication}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </>
  );
}
