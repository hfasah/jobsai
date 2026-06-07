"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  PenLine, Loader2, ArrowLeft, Copy, Check, Trash2, Save, Pencil,
  AlertCircle, ExternalLink, Clock, CircleCheck,
} from "lucide-react";
import type { LinkedInPost, LinkedInPostTone, LinkedInPostFormat } from "@/types/linkedin";

const TONES: { value: LinkedInPostTone; label: string }[] = [
  { value: "professional", label: "Professional" },
  { value: "story", label: "Personal story" },
  { value: "contrarian", label: "Contrarian take" },
  { value: "educational", label: "Educational" },
  { value: "celebratory", label: "Celebratory" },
];

const FORMATS: { value: LinkedInPostFormat; label: string }[] = [
  { value: "short", label: "Short" },
  { value: "standard", label: "Standard" },
  { value: "article", label: "Article" },
];

const LINKEDIN_COMPOSER = "https://www.linkedin.com/feed/?shareActive=true";

function fullText(p: LinkedInPost) {
  const tags = (p.hashtags ?? []).map((h) => `#${h}`).join(" ");
  return tags ? `${p.body}\n\n${tags}` : p.body;
}

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  posted: "bg-desyn-success/15 text-desyn-success",
};

function PostCard({
  post, onChanged, onDelete,
}: {
  post: LinkedInPost;
  onChanged: (p: LinkedInPost) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(post.body);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function patch(payload: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/linkedin/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (res.ok) onChanged(json.data);
    } finally {
      setBusy(false);
    }
  }

  async function copyAndOpen() {
    try {
      await navigator.clipboard.writeText(fullText(post));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked */ }
    window.open(LINKEDIN_COMPOSER, "_blank", "noopener");
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${STATUS_BADGE[post.status] ?? STATUS_BADGE.draft}`}>
            {post.status}
          </span>
          {post.topic && <span className="truncate text-xs text-muted-foreground">{post.topic}</span>}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {!editing && (
            <button onClick={() => { setBody(post.body); setEditing(true); }} title="Edit"
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <Pencil className="h-4 w-4" />
            </button>
          )}
          <button onClick={() => onDelete(post.id)} title="Delete"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {editing ? (
        <div className="space-y-3">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-primary"
          />
          <div className="flex items-center gap-2">
            <button onClick={async () => { await patch({ body }); setEditing(false); }} disabled={busy}
              className="btn-cta inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-sm disabled:opacity-70">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
            </button>
            <button onClick={() => setEditing(false)} className="text-sm text-muted-foreground hover:text-foreground">Cancel</button>
          </div>
        </div>
      ) : (
        <>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{post.body}</p>
          {(post.hashtags ?? []).length > 0 && (
            <p className="mt-3 flex flex-wrap gap-x-2 gap-y-1 text-sm font-medium text-[#0A66C2]">
              {post.hashtags.map((h) => <span key={h}>#{h}</span>)}
            </p>
          )}
        </>
      )}

      {!editing && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <button onClick={copyAndOpen}
            className="btn-cta inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-sm">
            {copied ? <Check className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
            {copied ? "Copied — opening LinkedIn" : "Copy & open LinkedIn"}
          </button>
          <button onClick={async () => { await navigator.clipboard.writeText(fullText(post)); }}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            <Copy className="h-4 w-4" /> Copy
          </button>

          {post.status !== "posted" ? (
            <button onClick={() => patch({ status: "posted" })} disabled={busy}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-desyn-success disabled:opacity-60">
              <CircleCheck className="h-4 w-4" /> Mark posted
            </button>
          ) : (
            <button onClick={() => patch({ status: "draft" })} disabled={busy}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60">
              Move to draft
            </button>
          )}

          <label className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <input
              type="datetime-local"
              defaultValue={post.scheduled_at ? new Date(post.scheduled_at).toISOString().slice(0, 16) : ""}
              onChange={(e) => patch({ scheduled_at: e.target.value || null })}
              className="rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
        </div>
      )}
    </div>
  );
}

export default function ContentStudioPage() {
  const [posts, setPosts] = useState<LinkedInPost[] | null>(null);
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState<LinkedInPostTone>("professional");
  const [format, setFormat] = useState<LinkedInPostFormat>("standard");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/linkedin/posts")
      .then((r) => r.json())
      .then((j) => { if (active) setPosts(j.data ?? []); })
      .catch(() => { if (active) setPosts([]); });
    return () => { active = false; };
  }, []);

  async function generate() {
    if (topic.trim().length < 3) { setError("Tell us what the post should be about."); return; }
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/linkedin/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, tone, format }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Generation failed");
      setPosts((prev) => [json.data, ...(prev ?? [])]);
      setTopic("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this post?")) return;
    await fetch(`/api/linkedin/posts/${id}`, { method: "DELETE" });
    setPosts((prev) => (prev ?? []).filter((p) => p.id !== id));
  }

  function onChanged(updated: LinkedInPost) {
    setPosts((prev) => (prev ?? []).map((p) => (p.id === updated.id ? updated : p)));
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <Link href="/dashboard/linkedin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> LinkedIn
      </Link>

      <div className="mt-6 flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-brand text-white shadow-glow">
          <PenLine className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Content Studio</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Generate field-relevant writeups, refine them, and publish to LinkedIn.
          </p>
        </div>
      </div>

      {/* Generator */}
      <div className="mt-6 space-y-3 rounded-2xl border border-border bg-card p-5">
        <textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="What's the post about? e.g. “3 lessons from migrating our infra to Kubernetes”"
          rows={2}
          className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <select value={tone} onChange={(e) => setTone(e.target.value as LinkedInPostTone)}
            className="h-10 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none">
            {TONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select value={format} onChange={(e) => setFormat(e.target.value as LinkedInPostFormat)}
            className="h-10 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none">
            {FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
          <button onClick={generate} disabled={generating}
            className="btn-cta inline-flex h-10 items-center justify-center gap-2 rounded-lg px-6 text-sm disabled:opacity-70">
            {generating ? <><Loader2 className="h-4 w-4 animate-spin" /> Writing…</> : <><PenLine className="h-4 w-4" /> Generate</>}
          </button>
        </div>
        {error && (
          <div className="flex items-start gap-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </div>
        )}
      </div>

      {/* Posts list */}
      <div className="mt-8 space-y-4">
        {posts === null ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            No posts yet. Generate your first writeup above.
          </div>
        ) : (
          posts.map((p) => (
            <PostCard key={p.id} post={p} onChanged={onChanged} onDelete={remove} />
          ))
        )}
      </div>
    </main>
  );
}
