"use client";

import { useEffect, useState } from "react";
import {
  Loader2, Globe, Copy, Check, CheckCircle2, ExternalLink, Rss, Sparkles, Zap,
  KeyRound, Plus, Trash2, Download, Upload, RotateCw, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Board {
  id: string;
  name: string;
  logo: string;
  reach: string;
  method: "feed" | "structured" | "manual";
  setupUrl?: string;
  instructions: string;
}

// method: feed = auto via XML feed · structured = auto via on-page data (Google)
//         manual = needs a one-time submission
const BOARDS: Board[] = [
  { id: "google",      name: "Google for Jobs", logo: "🔍", reach: "Largest — Google Search", method: "structured", instructions: "Automatic. Every active job page carries Google JobPosting structured data, so Google indexes your roles into Google Jobs. No setup needed — just make sure jobs are public." },
  { id: "indeed",      name: "Indeed",          logo: "🔵", reach: "250M+ visitors/mo", method: "feed", setupUrl: "https://employers.indeed.com/p/post-job", instructions: "In Indeed, add your XML feed URL under Job Feeds (or email it to your Indeed rep). Indeed crawls it every few hours and posts all active jobs automatically." },
  { id: "ziprecruiter",name: "ZipRecruiter",    logo: "🟢", reach: "110M+ job seekers", method: "feed", setupUrl: "https://www.ziprecruiter.com/employer", instructions: "Submit your feed URL to ZipRecruiter's feed onboarding. They ingest it and distribute to their partner network too." },
  { id: "jooble",      name: "Jooble",          logo: "🟡", reach: "Global aggregator", method: "feed", setupUrl: "https://jooble.org/employers", instructions: "Register your XML feed in Jooble's employer portal — free organic indexing." },
  { id: "adzuna",      name: "Adzuna",          logo: "🟣", reach: "16 countries", method: "feed", setupUrl: "https://www.adzuna.com/employers.html", instructions: "Send your feed URL to Adzuna's feeds team to syndicate across their network." },
  { id: "talroo",      name: "Talroo",          logo: "🔶", reach: "High-volume hiring", method: "feed", instructions: "Provide your XML feed to Talroo for performance-based distribution." },
  { id: "linkedin",    name: "LinkedIn",        logo: "🔷", reach: "1B+ members", method: "manual", setupUrl: "https://www.linkedin.com/talent/post-a-job", instructions: "LinkedIn free 'Limited Listings' can ingest a feed via a partnership, or post manually. Use the AI-generated LinkedIn copy on the job's Distribution tab for a polished manual post." },
  { id: "glassdoor",   name: "Glassdoor",       logo: "🟩", reach: "Employer brand", method: "feed", instructions: "Glassdoor sources from Indeed's network — once Indeed is connected, your jobs appear on Glassdoor too." },
];

const METHOD_META: Record<string, { label: string; color: string }> = {
  structured: { label: "Automatic", color: "bg-green-500/15 text-green-400 border-green-500/30" },
  feed:       { label: "Via feed",  color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  manual:     { label: "One-time setup", color: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
};

export default function JobBoardsPage() {
  const [slug, setSlug] = useState("");
  const [connected, setConnected] = useState<string[]>([]);
  const [activeJobs, setActiveJobs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/enterprise/boards").then((r) => r.json()).then((j) => {
      if (j.data) { setSlug(j.data.slug); setConnected(j.data.connected ?? []); setActiveJobs(j.data.active_jobs ?? 0); }
    }).finally(() => setLoading(false));
  }, []);

  const origin = typeof window !== "undefined" ? window.location.origin : "https://jobsai.work";
  const feedUrl = `${origin}/api/feeds/${slug}/jobs.xml`;
  const careersUrl = `${origin}/careers/${slug}`;

  const copy = (text: string, id: string) => { navigator.clipboard.writeText(text); setCopied(id); setTimeout(() => setCopied(null), 1500); };

  const toggleConnected = (id: string) => {
    const next = connected.includes(id) ? connected.filter((x) => x !== id) : [...connected, id];
    setConnected(next);
    fetch("/api/enterprise/boards", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ connected: next }) });
  };

  if (loading) return <main className="flex flex-1 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></main>;

  const autoCount = connected.length + 1; // +1 for Google (always on)

  return (
    <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Globe className="h-6 w-6 text-primary" /> Job Boards</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Post once — syndicate everywhere. Connect your feed to each board once; every job you publish then distributes automatically.
          </p>
        </div>

        {/* Hero status */}
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-brand shadow-glow"><Zap className="h-5 w-5 text-white" /></div>
            <div>
              <p className="font-semibold">{activeJobs} active {activeJobs === 1 ? "job" : "jobs"} distributing to {autoCount} {autoCount === 1 ? "board" : "boards"}</p>
              <p className="text-sm text-muted-foreground">Google for Jobs is always on. Connect more below to widen reach.</p>
            </div>
          </div>
        </div>

        {/* Feeds */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-1 flex items-center gap-2 font-semibold"><Rss className="h-4 w-4 text-primary" /> Your job feed</h2>
          <p className="mb-3 text-sm text-muted-foreground">Register this single URL with each board below. It auto-updates as you post, pause, or close jobs.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-lg border border-border bg-background px-3 py-2 text-xs">{feedUrl}</code>
            <button onClick={() => copy(feedUrl, "feed")} className="btn-cta inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold">
              {copied === "feed" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied === "feed" ? "Copied" : "Copy"}
            </button>
            <a href={feedUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-border p-2 hover:bg-muted"><ExternalLink className="h-3.5 w-3.5" /></a>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Public careers page:</span>
            <code className="flex-1 overflow-x-auto rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs">{careersUrl}</code>
            <button onClick={() => copy(careersUrl, "careers")} className="rounded-lg border border-border p-1.5 hover:bg-muted">{copied === "careers" ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}</button>
          </div>
        </div>

        {/* Boards */}
        <div className="space-y-3">
          {BOARDS.map((b) => {
            const isConnected = b.method === "structured" || connected.includes(b.id);
            const meta = METHOD_META[b.method];
            const open = expanded === b.id;
            return (
              <div key={b.id} className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-5 py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="text-2xl">{b.logo}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{b.name}</p>
                        <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium", meta.color)}>{meta.label}</span>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{b.reach}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {b.method === "structured" ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-400"><CheckCircle2 className="h-3.5 w-3.5" /> Live</span>
                    ) : (
                      <button onClick={() => toggleConnected(b.id)}
                        className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                          isConnected ? "bg-green-500/15 text-green-400" : "border border-border text-muted-foreground hover:bg-muted")}>
                        {isConnected ? <><CheckCircle2 className="h-3.5 w-3.5" /> Connected</> : "Mark connected"}
                      </button>
                    )}
                    <button onClick={() => setExpanded(open ? null : b.id)} className="text-xs text-primary hover:underline">{open ? "Hide" : "Setup"}</button>
                  </div>
                </div>
                {open && (
                  <div className="border-t border-border px-5 py-3.5 text-sm text-muted-foreground">
                    <p>{b.instructions}</p>
                    {b.method === "feed" && (
                      <div className="mt-2 flex items-center gap-2">
                        <code className="flex-1 overflow-x-auto rounded bg-background px-2 py-1 text-[11px]">{feedUrl}</code>
                        <button onClick={() => copy(feedUrl, b.id)} className="rounded border border-border p-1 hover:bg-muted">{copied === b.id ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}</button>
                      </div>
                    )}
                    {b.setupUrl && (
                      <a href={b.setupUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                        <ExternalLink className="h-3 w-3" /> Open {b.name} setup
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Bring your own credentials */}
        <BoardCredentials />

        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="flex items-center gap-2 text-sm font-medium"><Sparkles className="h-4 w-4 text-primary" /> Need polished copy for manual posts?</p>
          <p className="mt-1 text-sm text-muted-foreground">Open any job → <strong>Distribution</strong> tab to get AI-written, platform-optimized versions for LinkedIn, Indeed, Twitter/X, email, and Google — with tracking links.</p>
        </div>
      </div>
    </main>
  );
}

// ── Bring-your-own-credentials connections ────────────────────────────────────
interface Cred {
  id: string; board: string; label: string; direction: "post" | "pull" | "both";
  api_key: string | null; account_id: string | null; feed_url: string | null;
  enabled: boolean; last_sync: string | null; jobs_imported: number;
}

const DIR_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  post: { label: "Post", icon: Upload, color: "text-green-400" },
  pull: { label: "Pull", icon: Download, color: "text-blue-400" },
  both: { label: "Post + Pull", icon: RotateCw, color: "text-purple-400" },
};

function BoardCredentials() {
  const [creds, setCreds] = useState<Cred[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ board: "", label: "", direction: "post", api_key: "", account_id: "", feed_url: "" });
  const [saving, setSaving] = useState(false);
  const [pulling, setPulling] = useState<string | null>(null);
  const [pullMsg, setPullMsg] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/enterprise/board-credentials").then((r) => r.json()).then((j) => setCreds(j.data ?? [])).finally(() => setLoading(false));
  }, []);

  const add = async () => {
    if (!form.board.trim()) { setError("Board name is required."); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/enterprise/board-credentials", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error ?? "Failed."); setSaving(false); return; }
    setCreds((c) => [...c, json.data]);
    setForm({ board: "", label: "", direction: "post", api_key: "", account_id: "", feed_url: "" });
    setShowForm(false); setSaving(false);
  };

  const remove = async (id: string) => {
    setCreds((c) => c.filter((x) => x.id !== id));
    await fetch(`/api/enterprise/board-credentials/${id}`, { method: "DELETE" });
  };

  const pull = async (id: string) => {
    setPulling(id); setPullMsg((m) => ({ ...m, [id]: "" }));
    const res = await fetch(`/api/enterprise/board-credentials/${id}/pull`, { method: "POST" });
    const json = await res.json();
    setPullMsg((m) => ({ ...m, [id]: res.ok ? `Imported ${json.imported} of ${json.found} jobs` : (json.error ?? "Pull failed") }));
    if (res.ok) setCreds((c) => c.map((x) => x.id === id ? { ...x, last_sync: new Date().toISOString(), jobs_imported: x.jobs_imported + json.imported } : x));
    setPulling(null);
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold"><KeyRound className="h-4 w-4 text-primary" /> Your own board credentials</h2>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted">
            <Plus className="h-3.5 w-3.5" /> Connect a board
          </button>
        )}
      </div>
      <p className="mb-3 text-sm text-muted-foreground">
        Partners can plug in their own API credentials or feed URLs to <strong>post to</strong> or <strong>pull jobs from</strong> any board — however they see fit.
      </p>

      {showForm && (
        <div className="mb-4 rounded-xl border border-border bg-background/40 p-4 space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <input value={form.board} onChange={(e) => setForm((f) => ({ ...f, board: e.target.value }))} placeholder="Board (e.g. ZipRecruiter)"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            <select value={form.direction} onChange={(e) => setForm((f) => ({ ...f, direction: e.target.value }))}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="post">Post jobs to this board</option>
              <option value="pull">Pull jobs from this board</option>
              <option value="both">Both</option>
            </select>
            <input value={form.api_key} onChange={(e) => setForm((f) => ({ ...f, api_key: e.target.value }))} placeholder="API key / token (if any)" type="password"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            <input value={form.account_id} onChange={(e) => setForm((f) => ({ ...f, account_id: e.target.value }))} placeholder="Publisher / account ID (if any)"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          {(form.direction === "pull" || form.direction === "both") && (
            <input value={form.feed_url} onChange={(e) => setForm((f) => ({ ...f, feed_url: e.target.value }))} placeholder="Feed URL to pull jobs from (XML/RSS)"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <button onClick={add} disabled={saving} className="btn-cta inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save connection
            </button>
            <button onClick={() => { setShowForm(false); setError(""); }} className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted">Cancel</button>
          </div>
        </div>
      )}

      {loading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : creds.length === 0 ? (
        <p className="text-sm text-muted-foreground">No custom connections yet.</p>
      ) : (
        <div className="space-y-2">
          {creds.map((c) => {
            const dir = DIR_META[c.direction];
            const DirIcon = dir.icon;
            const canPull = c.direction === "pull" || c.direction === "both";
            return (
              <div key={c.id} className="rounded-xl border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-medium">{c.label || c.board}</span>
                    <span className={cn("inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium", dir.color)}>
                      <DirIcon className="h-2.5 w-2.5" /> {dir.label}
                    </span>
                    {c.api_key && <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] text-green-400">key set</span>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {canPull && (
                      <button onClick={() => pull(c.id)} disabled={pulling === c.id}
                        className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-50">
                        {pulling === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Pull now
                      </button>
                    )}
                    <button onClick={() => remove(c.id)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
                {(c.last_sync || pullMsg[c.id]) && (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {pullMsg[c.id] || (c.last_sync ? `Last pull: ${new Date(c.last_sync).toLocaleString()} · ${c.jobs_imported} imported` : "")}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
