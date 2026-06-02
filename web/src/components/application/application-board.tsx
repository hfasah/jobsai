"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Loader2, Plus } from "lucide-react";
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

export function ApplicationBoard() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<ApplicationStage | null>(null);

  const fetchApplications = useCallback(async () => {
    const res = await fetch("/api/applications");
    const json = await res.json();
    if (json.data) setApplications(json.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const byStage = useMemo(() => {
    const map: Record<ApplicationStage, Application[]> = {
      saved: [],
      applied: [],
      interviewing: [],
      offer: [],
      rejected: [],
    };
    for (const a of applications) map[a.stage]?.push(a);
    return map;
  }, [applications]);

  const trackedJobIds = useMemo(
    () => new Set(applications.map((a) => a.job_id)),
    [applications]
  );

  const updateApplication = useCallback(
    async (id: string, body: UpdateApplicationBody) => {
      // Optimistic update
      setApplications((prev) =>
        prev.map((a) => (a.id === id ? { ...a, ...body } as Application : a))
      );
      const res = await fetch(`/api/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const json = await res.json();
        setApplications((prev) => prev.map((a) => (a.id === id ? { ...a, ...json.data } : a)));
      } else {
        fetchApplications(); // reconcile on failure
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
    if (json.data) {
      // Re-fetch to pull the joined job summary onto the new card
      await fetchApplications();
    }
  }, [fetchApplications]);

  const handleDrop = useCallback(
    (stage: ApplicationStage) => {
      setDragOverStage(null);
      const id = draggingId;
      setDraggingId(null);
      if (!id) return;
      const card = applications.find((a) => a.id === id);
      if (!card || card.stage === stage) return;
      updateApplication(id, { stage });
    },
    [draggingId, applications, updateApplication]
  );

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
          <Plus className="mr-2 h-4 w-4" />
          Add job
        </Button>
      </div>

      {applications.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">No applications tracked yet.</p>
          <Button className="mt-4" onClick={() => setPickerOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add your first job
          </Button>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {APPLICATION_STAGES.map((stage) => {
            const cards = byStage[stage];
            return (
              <div
                key={stage}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragOverStage !== stage) setDragOverStage(stage);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setDragOverStage((s) => (s === stage ? null : s));
                  }
                }}
                onDrop={() => handleDrop(stage)}
                className={cn(
                  "flex flex-col rounded-xl border border-t-4 border-border bg-muted/30 p-3 transition-colors",
                  STAGE_ACCENT[stage],
                  dragOverStage === stage && "bg-primary/5 ring-2 ring-primary/30"
                )}
              >
                <div className="mb-3 flex items-center justify-between px-1">
                  <h2 className="text-sm font-semibold">{STAGE_LABELS[stage]}</h2>
                  <span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {cards.length}
                  </span>
                </div>
                <div className="flex min-h-[60px] flex-col gap-2.5">
                  {cards.map((a) => (
                    <ApplicationCard
                      key={a.id}
                      application={a}
                      onUpdate={updateApplication}
                      onDelete={deleteApplication}
                      onDragStart={setDraggingId}
                      dragging={draggingId === a.id}
                    />
                  ))}
                </div>
              </div>
            );
          })}
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
