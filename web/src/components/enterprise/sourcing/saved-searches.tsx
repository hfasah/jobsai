"use client";

// Saved-search chips: load, save-current, rename, duplicate, share, delete.
import { useCallback, useEffect, useState } from "react";
import { Bookmark, BookmarkPlus, Check, Copy, Globe2, Loader2, Lock, Pencil, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScoreWeights, SourcingFilters } from "@/lib/sourcing/types";

export interface SavedSearch {
  id: string;
  name: string;
  query_text: string | null;
  filters: SourcingFilters;
  mode: string;
  weights: Partial<ScoreWeights> | null;
  visibility: "private" | "shared";
  last_run_at: string | null;
  run_count: number;
  created_by: string;
}

export default function SavedSearches({
  current,
  onLoad,
}: {
  current: { query: string; filters: SourcingFilters | null; mode: string; weights: ScoreWeights } | null;
  onLoad: (s: SavedSearch) => void;
}) {
  const [items, setItems] = useState<SavedSearch[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [namePrompt, setNamePrompt] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/enterprise/sourcing/searches");
      const json = await res.json();
      if (res.ok) setItems(json.data ?? []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveCurrent = async () => {
    if (!current?.filters || !name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/enterprise/sourcing/searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          query: current.query,
          filters: current.filters,
          mode: current.mode,
          weights: current.weights,
        }),
      });
      if (res.ok) {
        setName("");
        setNamePrompt(false);
        await load();
        setOpen(true);
      }
    } finally {
      setSaving(false);
    }
  };

  const act = async (id: string, fn: () => Promise<void>) => {
    setBusyId(id);
    try { await fn(); await load(); } finally { setBusyId(null); }
  };

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium",
            open ? "border-primary/40 text-primary" : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          <Bookmark className="h-3.5 w-3.5" /> Saved searches {items.length > 0 && `(${items.length})`}
        </button>
        {current?.filters && !namePrompt && (
          <button
            onClick={() => setNamePrompt(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <BookmarkPlus className="h-3.5 w-3.5" /> Save this search
          </button>
        )}
        {namePrompt && (
          <span className="inline-flex items-center gap-1.5">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveCurrent()}
              placeholder="Search name…"
              className="w-44 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button onClick={saveCurrent} disabled={saving || !name.trim()} className="btn-cta rounded-lg px-2.5 py-1.5 text-xs font-semibold disabled:opacity-60">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
            </button>
            <button onClick={() => setNamePrompt(false)} aria-label="Cancel"><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
          </span>
        )}
      </div>

      {open && items.length > 0 && (
        <div className="mt-2 space-y-1 rounded-2xl border border-border bg-card p-2">
          {items.map((s) => (
            <div key={s.id} className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-muted/30">
              {renamingId === s.id ? (
                <span className="flex flex-1 items-center gap-1.5">
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        act(s.id, async () => {
                          await fetch(`/api/enterprise/sourcing/searches/${s.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ name: renameValue }),
                          });
                        });
                        setRenamingId(null);
                      }
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    className="w-48 rounded-lg border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </span>
              ) : (
                <button onClick={() => onLoad(s)} className="flex flex-1 items-center gap-2 text-left">
                  <span className="text-sm">{s.name}</span>
                  {s.visibility === "shared" ? (
                    <Globe2 className="h-3 w-3 text-sky-400" aria-label="Shared with team" />
                  ) : (
                    <Lock className="h-3 w-3 text-muted-foreground/50" aria-label="Private" />
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    {s.run_count > 0 ? `run ${s.run_count}×` : "never run"}
                  </span>
                </button>
              )}
              <span className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                {busyId === s.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <button
                      title="Rename"
                      onClick={() => { setRenamingId(s.id); setRenameValue(s.name); }}
                      className="rounded p-1 text-muted-foreground/60 hover:text-foreground"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      title={s.visibility === "shared" ? "Make private" : "Share with team"}
                      onClick={() =>
                        act(s.id, async () => {
                          await fetch(`/api/enterprise/sourcing/searches/${s.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ visibility: s.visibility === "shared" ? "private" : "shared" }),
                          });
                        })
                      }
                      className="rounded p-1 text-muted-foreground/60 hover:text-foreground"
                    >
                      {s.visibility === "shared" ? <Lock className="h-3 w-3" /> : <Globe2 className="h-3 w-3" />}
                    </button>
                    <button
                      title="Duplicate"
                      onClick={() =>
                        act(s.id, async () => {
                          await fetch(`/api/enterprise/sourcing/searches/${s.id}/duplicate`, { method: "POST" });
                        })
                      }
                      className="rounded p-1 text-muted-foreground/60 hover:text-foreground"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                    <button
                      title="Delete"
                      onClick={() =>
                        act(s.id, async () => {
                          await fetch(`/api/enterprise/sourcing/searches/${s.id}`, { method: "DELETE" });
                        })
                      }
                      className="rounded p-1 text-muted-foreground/60 hover:text-red-400"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
      {open && items.length === 0 && (
        <p className="mt-2 rounded-2xl border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
          No saved searches yet — run a search and hit <Check className="inline h-3 w-3" /> Save this search.
        </p>
      )}
    </div>
  );
}
