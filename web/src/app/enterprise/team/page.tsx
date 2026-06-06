"use client";

import { useEffect, useState } from "react";
import {
  Users, Loader2, Plus, Trash2, Mail, Shield, ShieldCheck, UserCog,
  Crown, Clock, RotateCw, X, Check, Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Member {
  id: string; user_id: string; role: string; name: string; email: string; image_url: string | null; created_at: string;
}
interface Invitation { id: string; email: string; role: string; created_at: string }

const ROLE_META: Record<string, { label: string; icon: React.ElementType; color: string; desc: string }> = {
  owner:     { label: "Owner",     icon: Crown,     color: "text-amber-400",  desc: "Full control. Manage billing, members, and delete the org." },
  admin:     { label: "Admin",     icon: ShieldCheck, color: "text-purple-400", desc: "Manage jobs, candidates, and invite members. Cannot remove members." },
  recruiter: { label: "Recruiter", icon: UserCog,   color: "text-blue-400",   desc: "Work jobs, candidates, pools, interviews, and pre-boarding." },
};

const PERMISSIONS = [
  { action: "View jobs, candidates & pools",        owner: true, admin: true, recruiter: true },
  { action: "Post & edit jobs",                      owner: true, admin: true, recruiter: true },
  { action: "Screen, move & report on candidates",   owner: true, admin: true, recruiter: true },
  { action: "Run references & background checks",    owner: true, admin: true, recruiter: true },
  { action: "Invite team members",                   owner: true, admin: true, recruiter: false },
  { action: "Change member roles",                   owner: true, admin: true, recruiter: false },
  { action: "Remove members",                        owner: true, admin: false, recruiter: false },
  { action: "Export org data & manage billing",      owner: true, admin: false, recruiter: false },
];

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
  const canRemove = myRole === "owner";

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
    setMembers((m) => m.map((x) => x.id === id ? { ...x, role } : x));
    await fetch(`/api/enterprise/team/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }) });
  };
  const removeMember = async (id: string) => {
    setBusyId(id);
    const res = await fetch(`/api/enterprise/team/${id}`, { method: "DELETE" });
    if (res.ok) setMembers((m) => m.filter((x) => x.id !== id));
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
              const meta = ROLE_META[m.role] ?? ROLE_META.recruiter;
              const Icon = meta.icon;
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
                        {["owner", "admin", "recruiter"].map((r) => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
                      </select>
                    ) : (
                      <span className={cn("inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs font-medium", meta.color)}>
                        <Icon className="h-3 w-3" /> {meta.label}
                      </span>
                    )}
                    {canRemove && !isSelf && (
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
                {(myRole === "owner" ? ["admin", "recruiter"] : ["recruiter"]).map((r) => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
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
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] capitalize text-muted-foreground">{inv.role}</span>
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

        {/* Roles & permissions reference */}
        <section className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
            <Shield className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Roles &amp; permissions</h2>
          </div>
          <div className="p-5">
            <div className="mb-4 grid gap-2 sm:grid-cols-3">
              {(["owner", "admin", "recruiter"] as const).map((r) => {
                const meta = ROLE_META[r]; const Icon = meta.icon;
                return (
                  <div key={r} className="rounded-xl border border-border p-3">
                    <p className={cn("flex items-center gap-1.5 text-sm font-semibold", meta.color)}><Icon className="h-3.5 w-3.5" /> {meta.label}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">{meta.desc}</p>
                  </div>
                );
              })}
            </div>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">Permission</th>
                <th className="pb-2 text-center font-medium">Owner</th>
                <th className="pb-2 text-center font-medium">Admin</th>
                <th className="pb-2 text-center font-medium">Recruiter</th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {PERMISSIONS.map((p) => (
                  <tr key={p.action}>
                    <td className="py-2 text-muted-foreground">{p.action}</td>
                    {(["owner", "admin", "recruiter"] as const).map((r) => (
                      <td key={r} className="py-2 text-center">
                        {p[r] ? <Check className="mx-auto h-4 w-4 text-green-400" /> : <span className="text-muted-foreground/30">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
