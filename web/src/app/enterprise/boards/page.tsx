"use client";

import { useEffect, useState } from "react";
import {
  Loader2, Globe, Copy, Check, CheckCircle2, ExternalLink, Rss, Sparkles, Zap,
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

        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="flex items-center gap-2 text-sm font-medium"><Sparkles className="h-4 w-4 text-primary" /> Need polished copy for manual posts?</p>
          <p className="mt-1 text-sm text-muted-foreground">Open any job → <strong>Distribution</strong> tab to get AI-written, platform-optimized versions for LinkedIn, Indeed, Twitter/X, email, and Google — with tracking links.</p>
        </div>
      </div>
    </main>
  );
}
