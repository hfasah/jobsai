"use client";

import { useEffect, useState } from "react";
import {
  Users, Loader2, Plus, Trash2, Mail, Shield, ShieldCheck, UserCog,
  Crown, Clock, RotateCw, X, Check, Lock, Eye, Briefcase, Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ROLE_LABELS, ROLE_DESCRIPTIONS, ASSIGNABLE_ROLES,
  type Permission, ROLE_PERMISSIONS,
} from "@/lib/enterprise-rbac";
import type { MemberRole } from "@/types/enterprise";

interface Member {
  id: string; user_id: string; role: string; name: string; email: string; image_url: string | null; created_at: string;
}
interface Invitation { id: string; email: string; role: string; created_at: string }

const ROLE_ICONS: Record<string, React.ElementType> = {
  owner:           Crown,
  admin:           ShieldCheck,
  recruiter:       UserCog,
  hiring_manager:  Briefcase,
  interviewer:     Star,
  department_head: Shield,
  viewer:          Eye,
};

const ROLE_COLORS: Record<string, string> = {
  owner:           "text-amber-400",
  admin:           "text-purple-400",
  recruiter:       "text-blue-400",
  hiring_manager:  "text-sky-400",
  interviewer:     "text-teal-400",
  department_head: "text-indigo-400",
  viewer:          "text-slate-400",
};

const PERMISSION_LABELS: Partial<Record<Permission, string>> = {
  can_view_applications:   "View applications",
  can_move_stages:         "Move pipeline stages",
  can_send_emails:         "Send candidate emails",
  can_send_offers:         "Send offer letters",
  can_manage_jobs:         "Post & edit jobs",
  can_invite_members:      "Invite team members",
  can_manage_settings:     "Manage settings",
  can_view_reports:        "View reports & analytics",
  can_add_notes:           "Add notes to applications",
  can_schedule_interviews: "Schedule interviews",
};

export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [myRole, setMyRole] = useState("recruiter");
  const [myUserId, setMyUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [inviteForm, setInviteForm] = useState({ email: "", role: "recruiter" });
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const canManage = ["owner", "admin"].includes(myRole);
  const canRemove = ["owner", "admin"].includes(myRole);

  const load = async () => {
    const res = await fetch("/api/enterprise/team");
    const json = await res.json();
    setMembers(json.data?.members ?? []);
    setInvitations(json.data?.invitations ?? []);
    setMyRole(json.data?.my_role ?? "recruiter");
    setMyUserId(json.data?.my_user_id ?? "");
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true); setError("");
    const res = await fetch("/api/enterprise/team", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(inviteForm),
    });
    const json = await res.json();
    if (!res.ok) setError(json.error ?? "Failed to invite.");
    else { setInvitations((i) => [json.data, ...i]); setInviteForm({ email: "", role: "recruiter" }); }
    setInviting(false);
  };

  const changeRole = async (id: string, role: string) => {
    const prev = members.find((x) => x.id === id)?.role;
    setMembers((m) => m.map((x) => x.id === id ? { ...x, role } : x));
    setError("");
    const res = await fetch(`/api/enterprise/team/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }) });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Couldn't change role.");
      if (prev) setMembers((m) => m.map((x) => x.id === id ? { ...x, role: prev } : x)); // revert
    }
  };
  const removeMember = async (id: string) => {
    if (!confirm("Remove this team member from the workspace?")) return;
    setBusyId(id); setError("");
    const res = await fetch(`/api/enterprise/team/${id}`, { method: "DELETE" });
    if (res.ok) setMembers((m) => m.filter((x) => x.id !== id));
    else { const j = await res.json().catch(() => ({})); setError(j.error ?? "Couldn't remove member."); }
    setBusyId(null);
  };
  const revokeInvite = async (id: string) => {
    await fetch(`/api/enterprise/invitations/${id}`, { method: "DELETE" });
    setInvitations((i) => i.filter((x) => x.id !== id));
  };
  const resendInvite = async (id: string) => {
    setBusyId(id);
    await fetch(`/api/enterprise/invitations/${id}`, { method: "POST" });
    setBusyId(null);
  };

  if (loading) return <main className="flex flex-1 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></main>;

  const assignableRoles: MemberRole[] = myRole === "owner"
    ? ASSIGNABLE_ROLES
    : ASSIGNABLE_ROLES.filter((r) => r !== "admin");

  return (
    <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Users className="h-6 w-6 text-primary" /> Team &amp; Access</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Manage who can access this workspace and what they can do.
            {!canManage && <span className="ml-1 inline-flex items-center gap-1 text-amber-400"><Lock className="h-3 w-3" /> View only — ask an admin to make changes.</span>}
          </p>
        </div>

        {/* Members */}
        <section className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="border-b border-border px-5 py-3.5">
            <h2 className="font-semibold">Members <span className="text-muted-foreground">({members.length})</span></h2>
          </div>
          <div className="divide-y divide-border">
            {members.map((m) => {
              const Icon = ROLE_ICONS[m.role] ?? UserCog;
              const color = ROLE_COLORS[m.role] ?? "text-slate-400";
              const isSelf = m.user_id === myUserId;
              return (
                <div key={m.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="flex min-w-0 items-center gap-3">
                    {m.image_url
                      ? <img src={m.image_url} alt={m.name} className="h-9 w-9 rounded-full" />
                      : <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">{m.name.charAt(0).toUpperCase()}</div>}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{m.name}{isSelf && <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>}</p>
                      <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {canManage && !isSelf ? (
                      <select value={m.role} onChange={(e) => changeRole(m.id, e.target.value)}
                        className="rounded-lg border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary">
                        {(myRole === "owner" ? ["owner", ...ASSIGNABLE_ROLES] : ASSIGNABLE_ROLES).map((r) => (
                          <option key={r} value={r}>{ROLE_LABELS[r as MemberRole] ?? r}</option>
                        ))}
                      </select>
                    ) : (
                      <span className={cn("inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs font-medium", color)}>
                        <Icon className="h-3 w-3" /> {ROLE_LABELS[m.role as MemberRole] ?? m.role}
                      </span>
                    )}
                    {canRemove && !isSelf && !(myRole === "admin" && m.role === "owner") && (
                      <button onClick={() => removeMember(m.id)} disabled={busyId === m.id}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
                        {busyId === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Invite */}
        {canManage && (
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-3 font-semibold">Invite people</h2>
            <form onSubmit={invite} className="flex flex-wrap gap-2">
              <input value={inviteForm.email} onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                type="email" required placeholder="colleague@company.com"
                className="flex-1 min-w-48 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              <select value={inviteForm.role} onChange={(e) => setInviteForm((f) => ({ ...f, role: e.target.value }))}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                {assignableRoles.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
              <button type="submit" disabled={inviting}
                className="btn-cta inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60">
                {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Send invite
              </button>
            </form>
            {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

            {/* Pending */}
            {invitations.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pending invitations</p>
                {invitations.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-sm">{inv.email}</p>
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {ROLE_LABELS[inv.role as MemberRole] ?? inv.role}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-amber-400"><Clock className="h-2.5 w-2.5" /> Pending</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => resendInvite(inv.id)} disabled={busyId === inv.id} title="Resend"
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                        {busyId === inv.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
                      </button>
                      <button onClick={() => revokeInvite(inv.id)} title="Revoke"
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Roles reference */}
        <section className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
            <Shield className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Roles &amp; permissions</h2>
          </div>
          <div className="p-5">
            <div className="mb-5 grid gap-2 sm:grid-cols-2">
              {(["owner", "admin", "recruiter", "hiring_manager", "interviewer", "department_head", "viewer"] as MemberRole[]).map((r) => {
                const Icon = ROLE_ICONS[r] ?? UserCog;
                const color = ROLE_COLORS[r] ?? "text-slate-400";
                return (
                  <div key={r} className="rounded-xl border border-border p-3">
                    <p className={cn("flex items-center gap-1.5 text-sm font-semibold", color)}>
                      <Icon className="h-3.5 w-3.5" /> {ROLE_LABELS[r]}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">{ROLE_DESCRIPTIONS[r]}</p>
                  </div>
                );
              })}
            </div>

            {/* Permission matrix */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">Permission</th>
                    {(["owner", "admin", "recruiter", "hiring_manager", "interviewer", "department_head", "viewer"] as MemberRole[]).map((r) => (
                      <th key={r} className="pb-2 text-center font-medium">{ROLE_LABELS[r].split(" ")[0]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(Object.keys(PERMISSION_LABELS) as Permission[]).map((perm) => (
                    <tr key={perm}>
                      <td className="py-1.5 pr-3 text-muted-foreground">{PERMISSION_LABELS[perm]}</td>
                      {(["owner", "admin", "recruiter", "hiring_manager", "interviewer", "department_head", "viewer"] as MemberRole[]).map((r) => (
                        <td key={r} className="py-1.5 text-center">
                          {ROLE_PERMISSIONS[r][perm]
                            ? <Check className="mx-auto h-3.5 w-3.5 text-green-400" />
                            : <span className="text-muted-foreground/30">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
