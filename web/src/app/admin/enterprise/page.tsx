"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Loader2, ExternalLink, Mail } from "lucide-react";

export default function AdminEnterprise() {
  const [users, setUsers] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/users?plan=enterprise&page=1")
      .then((r) => r.json())
      .then((j) => setUsers(j.users ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Enterprise Customers</h1>
        <p className="mt-1 text-sm text-muted-foreground">Recruiters, agencies and HR teams on enterprise plans.</p>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading…
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card py-20 text-center">
          <Building2 className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="font-semibold">No enterprise customers yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Enterprise customers will appear here once they&apos;re set up.</p>
          </div>
          <a href="mailto:enterprise@jobsai.co" className="inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-5 py-2.5 text-sm font-semibold text-white shadow-glow">
            <Mail className="h-4 w-4" /> Contact enterprise team
          </a>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                {["Organisation", "Contact", "Users", "Jobs Tracked", "Since", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => (
                <tr key={u.id as string} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{u.name as string}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email as string}</td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">{u.resumeCount as number}</td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">{u.jobCount as number}</td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(u.createdAt as number).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/users/${u.id}`} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs hover:bg-muted transition-colors">
                      <ExternalLink className="h-3 w-3" /> View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
