"use client";

// Agency workspace switcher. Renders in the shell header ONLY when the user
// can access more than one workspace (an agency parent + client workspaces),
// so it's invisible for standalone orgs. Switching sets the active-workspace
// cookie server-side and reloads.
import { useEffect, useRef, useState } from "react";
import { Building2, Check, ChevronsUpDown, Loader2, Plus, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";

interface Workspace {
  id: string;
  name: string;
  slug: string | null;
  parent_org_id: string | null;
  role: string;
  is_agency_parent: boolean;
  is_current: boolean;
}

// `agencyEnabled` (org has the agency_workspaces feature) forces the switcher
// to render even with a single workspace, so an agency can create its FIRST
// client workspace. Standalone orgs pass false → invisible.
export function WorkspaceSwitcher({ agencyEnabled = false }: { agencyEnabled?: boolean }) {
  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = () =>
    fetch("/api/enterprise/workspaces")
      .then((r) => r.json())
      .then((j) => setWorkspaces(j.data ?? []))
      .catch(() => setWorkspaces([]));

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Standalone org → no switcher. Agencies see it even with one workspace so
  // they can add their first client.
  if (!workspaces || (workspaces.length <= 1 && !agencyEnabled)) return null;

  const current = workspaces.find((w) => w.is_current) ?? workspaces[0];
  const canCreate = workspaces.some((w) => w.is_agency_parent || (w.parent_org_id === null && (w.role === "owner" || w.role === "admin")));

  const switchTo = async (id: string) => {
    if (id === current.id) { setOpen(false); return; }
    setBusy(id);
    const res = await fetch("/api/enterprise/workspaces/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace_id: id }),
    });
    if (res.ok) window.location.href = "/enterprise/dashboard";
    else setBusy(null);
  };

  const create = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const res = await fetch("/api/enterprise/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    const json = await res.json();
    setCreating(false);
    if (res.ok && json.data?.id) {
      await switchTo(json.data.id);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 rounded-lg border border-border px-2 py-1 text-left transition-colors hover:bg-muted/40"
      >
        {current.parent_org_id ? <Briefcase className="h-3 w-3 shrink-0 text-muted-foreground" /> : <Building2 className="h-3 w-3 shrink-0 text-primary" />}
        <span className="min-w-0 flex-1 truncate text-[11px] font-medium">{current.name}</span>
        <ChevronsUpDown className="h-3 w-3 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute left-0 top-9 z-40 w-64 rounded-xl border border-border bg-card p-1 shadow-2xl">
          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Workspaces</p>
          <div className="max-h-72 overflow-y-auto">
            {workspaces.map((w) => (
              <button
                key={w.id}
                onClick={() => switchTo(w.id)}
                className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted/50", w.is_current && "bg-muted/30")}
              >
                {w.parent_org_id ? <Briefcase className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <Building2 className="h-3.5 w-3.5 shrink-0 text-primary" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{w.name}</span>
                  <span className="block text-[10px] text-muted-foreground">{w.parent_org_id ? "Client workspace" : w.is_agency_parent ? "Agency" : "Workspace"}</span>
                </span>
                {busy === w.id ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : w.is_current && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            ))}
          </div>

          {canCreate && (
            <div className="mt-1 border-t border-border/60 pt-1">
              {showCreate ? (
                <div className="flex items-center gap-1 px-1 py-1">
                  <input
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") create(); if (e.key === "Escape") setShowCreate(false); }}
                    placeholder="Client name"
                    className="w-full rounded-lg border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button onClick={create} disabled={creating || !newName.trim()} className="btn-cta shrink-0 rounded-lg px-2 py-1 text-xs font-semibold disabled:opacity-60">
                    {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add"}
                  </button>
                </div>
              ) : (
                <button onClick={() => setShowCreate(true)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground">
                  <Plus className="h-3.5 w-3.5" /> Add client workspace
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
