"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2, ChevronDown, ChevronUp, ShieldOff, ShieldCheck } from "lucide-react";
import {
  ALL_PERMS, ROLE_GRANTS, ROLE_GRANT_CAP, ROLE_LABELS, PERM_LABELS,
  type AdminPerm, type AdminRole,
} from "@/lib/admin-perms";

interface StaffRow {
  user_id: string;
  email: string;
  display_name: string | null;
  role: AdminRole;
  overrides: Record<string, boolean>;
  grant_cap_daily: number | null;
  active: boolean;
  created_at: string;
}

const ROLE_OPTIONS: AdminRole[] = ["support_agent", "support_lead", "analyst", "sales", "super_admin"];

// The dangerous perms get a visual warning in the customizer.
const DANGEROUS: AdminPerm[] = ["users.money_refund", "users.delete", "users.impersonate", "partners.payout", "ops", "staff.manage"];

function effectivePerms(row: StaffRow): Set<AdminPerm> {
  const perms = new Set<AdminPerm>(ROLE_GRANTS[row.role]);
  for (const p of ALL_PERMS) {
    const v = row.overrides?.[p];
    if (v === true) perms.add(p);
    else if (v === false) perms.delete(p);
  }
  return perms;
}

export function StaffManager() {
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [envSuperIds, setEnvSuperIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Add form
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminRole>("support_agent");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/staff");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load staff.");
      setRows(json.staff ?? []);
      setEnvSuperIds(json.env_super_ids ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load staff.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function addStaff(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not add staff member.");
      setEmail("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add staff member.");
    } finally {
      setAdding(false);
    }
  }

  async function patchStaff(userId: string, patch: Record<string, unknown>) {
    setBusy(userId);
    setError(null);
    try {
      const res = await fetch("/api/admin/staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, ...patch }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Update failed.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setBusy(null);
    }
  }

  async function removeStaff(userId: string, staffEmail: string) {
    if (!window.confirm(`Remove ${staffEmail} from the admin portal entirely?`)) return;
    setBusy(userId);
    try {
      const res = await fetch("/api/admin/staff", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Remove failed.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Remove failed.");
    } finally {
      setBusy(null);
    }
  }

  function togglePerm(row: StaffRow, perm: AdminPerm) {
    const roleHas = ROLE_GRANTS[row.role].includes(perm);
    const effective = effectivePerms(row).has(perm);
    const next = { ...(row.overrides ?? {}) } as Record<string, boolean>;
    const wanted = !effective;
    if (wanted === roleHas) delete next[perm]; // back to role default — drop override
    else next[perm] = wanted;
    void patchStaff(row.user_id, { overrides: next });
  }

  if (loading) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading staff…</div>;

  return (
    <div className="space-y-6">
      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{error}</div>}

      {/* Add member */}
      <form onSubmit={addStaff} className="rounded-xl border border-border bg-card p-4 space-y-3">
        <p className="text-sm font-semibold">Add a staff member</p>
        <p className="text-xs text-muted-foreground">They need an existing JobsAI login (any account). Access applies the moment you add them.</p>
        <div className="flex flex-wrap gap-2">
          <input
            type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@company.com"
            className="flex-1 min-w-56 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <select value={role} onChange={(e) => setRole(e.target.value as AdminRole)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
            {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
          <button type="submit" disabled={adding}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
          </button>
        </div>
        {role === "support_agent" && (
          <p className="text-xs text-muted-foreground">Support Agents can grant up to {(ROLE_GRANT_CAP.support_agent ?? 0).toLocaleString()} credits/day; larger grants escalate to you.</p>
        )}
      </form>

      {/* Env super admins */}
      {envSuperIds.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-semibold mb-1">Owners (environment)</p>
          <p className="text-xs text-muted-foreground">Full access via ADMIN_USER_IDS — managed in Vercel env, can&apos;t be locked out from here.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {envSuperIds.map((id) => (
              <span key={id} className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-mono">{id}</span>
            ))}
          </div>
        </div>
      )}

      {/* Roster */}
      <div className="space-y-3">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">No staff yet — add your first support teammate above.</p>}
        {rows.map((row) => {
          const perms = effectivePerms(row);
          const overrideCount = Object.keys(row.overrides ?? {}).length;
          const isExpanded = expanded === row.user_id;
          return (
            <div key={row.user_id} className={`rounded-xl border bg-card ${row.active ? "border-border" : "border-border opacity-60"}`}>
              <div className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{row.display_name || row.email}</p>
                  <p className="text-xs text-muted-foreground truncate">{row.email}</p>
                </div>
                <select
                  value={row.role} disabled={busy === row.user_id}
                  onChange={(e) => patchStaff(row.user_id, { role: e.target.value })}
                  className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs">
                  {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
                {overrideCount > 0 && (
                  <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-500">{overrideCount} custom</span>
                )}
                <button
                  onClick={() => patchStaff(row.user_id, { active: !row.active })}
                  disabled={busy === row.user_id}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium ${row.active ? "bg-muted text-muted-foreground hover:text-foreground" : "bg-emerald-500/10 text-emerald-500"}`}>
                  {row.active ? <><ShieldOff className="h-3.5 w-3.5" /> Deactivate</> : <><ShieldCheck className="h-3.5 w-3.5" /> Reactivate</>}
                </button>
                <button onClick={() => setExpanded(isExpanded ? null : row.user_id)}
                  className="inline-flex items-center gap-1 rounded-lg bg-muted px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
                  {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />} Access
                </button>
                <button onClick={() => removeStaff(row.user_id, row.email)} disabled={busy === row.user_id}
                  className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {isExpanded && (
                <div className="border-t border-border p-4">
                  <p className="text-xs text-muted-foreground mb-3">
                    Toggle any tool for {row.display_name || row.email}. Unchecked = no access. Changes apply immediately.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {ALL_PERMS.map((perm) => {
                      const on = perms.has(perm);
                      const dangerous = DANGEROUS.includes(perm);
                      return (
                        <label key={perm} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-muted">
                          <input type="checkbox" checked={on} disabled={busy === row.user_id}
                            onChange={() => togglePerm(row, perm)} className="h-3.5 w-3.5 accent-primary" />
                          <span className={on && dangerous ? "text-amber-500 font-medium" : ""}>
                            {PERM_LABELS[perm]}{dangerous ? " ⚠" : ""}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {row.role === "support_agent" && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                      Daily grant cap:
                      <input
                        type="number" min={100} step={100}
                        defaultValue={row.grant_cap_daily ?? ROLE_GRANT_CAP.support_agent ?? 2000}
                        onBlur={(e) => {
                          const v = Math.round(Number(e.target.value));
                          if (Number.isFinite(v) && v > 0 && v !== (row.grant_cap_daily ?? ROLE_GRANT_CAP.support_agent)) {
                            void patchStaff(row.user_id, { grant_cap_daily: v });
                          }
                        }}
                        className="w-24 rounded-lg border border-border bg-background px-2 py-1 text-xs"
                      /> credits
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
