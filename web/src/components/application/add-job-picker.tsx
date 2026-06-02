"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PickableJob {
  id: string;
  title: string | null;
  company: string | null;
}

export function AddJobPicker({
  trackedJobIds,
  onAdd,
  onClose,
}: {
  trackedJobIds: Set<string>;
  onAdd: (jobId: string) => Promise<void>;
  onClose: () => void;
}) {
  const [jobs, setJobs] = useState<PickableJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/jobs")
      .then((r) => r.json())
      .then((j) => {
        const list = (j.data ?? [])
          .filter((row: { status: string }) => row.status === "ready")
          .map((row: { id: string; parsed: { title: string | null; company: string | null } | { title: string | null; company: string | null }[] | null }) => {
            const parsed = Array.isArray(row.parsed) ? row.parsed[0] : row.parsed;
            return { id: row.id, title: parsed?.title ?? null, company: parsed?.company ?? null };
          });
        setJobs(list);
        setLoading(false);
      });
  }, []);

  const untracked = jobs.filter((j) => !trackedJobIds.has(j.id));
  const filtered = query
    ? untracked.filter((j) =>
        `${j.title ?? ""} ${j.company ?? ""}`.toLowerCase().includes(query.toLowerCase())
      )
    : untracked;

  const handleAdd = async (jobId: string) => {
    setAdding(jobId);
    try {
      await onAdd(jobId);
    } finally {
      setAdding(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[10vh]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Add a job to your tracker</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-lg border border-border px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search jobs…"
            className="w-full bg-transparent py-2 text-sm outline-none"
          />
        </div>

        <div className="mt-4 max-h-72 space-y-1.5 overflow-y-auto">
          {loading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading jobs…
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {untracked.length === 0
                ? "All your jobs are already tracked."
                : "No jobs match your search."}
            </p>
          ) : (
            filtered.map((j) => (
              <div
                key={j.id}
                className="flex items-center gap-3 rounded-lg border border-border p-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{j.title ?? "Untitled role"}</p>
                  {j.company && (
                    <p className="truncate text-xs text-muted-foreground">{j.company}</p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAdd(j.id)}
                  disabled={adding === j.id}
                >
                  {adding === j.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
