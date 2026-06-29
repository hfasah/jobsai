"use client";

import { useEffect, useState } from "react";
import { Plus, Loader2, X, Trash2, Pencil, ExternalLink, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

const inputCls = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary";

type Post = {
  id: string; slug: string; title: string; excerpt: string | null;
  content_html: string | null; cover_image_url: string | null; author: string | null;
  tag: string | null; read_mins: number | null; published_at: string; source: string | null;
};

type Draft = {
  slug: string; title: string; excerpt: string; content_html: string;
  cover_image_url: string; author: string; tag: string; published_at: string;
};

const emptyDraft = (): Draft => ({
  slug: "", title: "", excerpt: "", content_html: "",
  cover_image_url: "", author: "", tag: "", published_at: "",
});

export default function AdminBlog() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editingSlug, setEditingSlug] = useState<string | null>(null); // null = creating
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch("/api/admin/blog").then((r) => r.json()).then((j) => setPosts(j.data ?? [])).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditingSlug(null); setError(null); setDraft(emptyDraft()); };
  const openEdit = (p: Post) => {
    setEditingSlug(p.slug); setError(null);
    setDraft({
      slug: p.slug, title: p.title, excerpt: p.excerpt ?? "", content_html: p.content_html ?? "",
      cover_image_url: p.cover_image_url ?? "", author: p.author ?? "", tag: p.tag ?? "",
      published_at: p.published_at ? p.published_at.slice(0, 10) : "",
    });
  };
  const set = (k: keyof Draft, v: string) => setDraft((d) => d ? { ...d, [k]: v } : d);

  const save = async () => {
    if (!draft) return;
    if (!draft.title.trim()) { setError("Title is required."); return; }
    if (!draft.content_html.trim()) { setError("Article body is required."); return; }
    setSaving(true); setError(null);
    const res = await fetch("/api/admin/blog", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...draft, slug: editingSlug ?? draft.slug }),
    });
    const j = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok) { setDraft(null); load(); }
    else setError(j.error ?? "Couldn't save the article.");
  };

  const remove = async (p: Post) => {
    if (!confirm(`Delete "${p.title}"? This can't be undone.`)) return;
    const res = await fetch(`/api/admin/blog/${p.slug}`, { method: "DELETE" });
    if (res.ok) setPosts((ps) => ps.filter((x) => x.id !== p.id));
    else alert("Couldn't delete the article.");
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Blog</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Write and manage articles shown on /enterprise/blog.</p>
        </div>
        <button onClick={openNew} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
          <Plus className="h-4 w-4" /> New article
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center">
          <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No articles yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">Click “New article” to write your first post.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr>
                {["Title", "Tag", "Author", "Published", "Source", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {posts.map((p) => (
                <tr key={p.id} className="transition-colors hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <p className="font-medium">{p.title}</p>
                    <p className="text-xs text-muted-foreground">/{p.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{p.tag ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{p.author ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(p.published_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
                      p.source === "admin" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                      {p.source ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                      <a href={`/enterprise/blog/${p.slug}`} target="_blank" rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground" title="View">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      <button onClick={() => openEdit(p)} className="text-muted-foreground hover:text-foreground" title="Edit"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => remove(p)} className="text-muted-foreground hover:text-red-400" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Composer slide-over */}
      {draft && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm" onClick={() => setDraft(null)}>
          <div className="flex h-full w-full max-w-2xl flex-col border-l border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border p-4">
              <h2 className="font-bold">{editingSlug ? "Edit article" : "New article"}</h2>
              <button onClick={() => setDraft(null)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Title</label>
                <input value={draft.title} onChange={(e) => set("title", e.target.value)} className={inputCls} placeholder="How AI is changing recruiting" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Tag</label>
                  <input value={draft.tag} onChange={(e) => set("tag", e.target.value)} className={inputCls} placeholder="Recruiting" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Author</label>
                  <input value={draft.author} onChange={(e) => set("author", e.target.value)} className={inputCls} placeholder="The JobsAI Team" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Slug <span className="font-normal text-muted-foreground">(optional)</span></label>
                  <input value={draft.slug} onChange={(e) => set("slug", e.target.value)} disabled={!!editingSlug}
                    className={cn(inputCls, editingSlug && "opacity-60")} placeholder="auto from title" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Publish date <span className="font-normal text-muted-foreground">(optional)</span></label>
                  <input type="date" value={draft.published_at} onChange={(e) => set("published_at", e.target.value)} className={inputCls} />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Cover image URL <span className="font-normal text-muted-foreground">(optional)</span></label>
                <input value={draft.cover_image_url} onChange={(e) => set("cover_image_url", e.target.value)} className={inputCls} placeholder="https://…" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Excerpt <span className="font-normal text-muted-foreground">(optional — auto from body)</span></label>
                <textarea value={draft.excerpt} onChange={(e) => set("excerpt", e.target.value)} rows={2} className={inputCls} placeholder="One-line summary shown on the blog list." />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Body <span className="font-normal text-muted-foreground">(HTML)</span></label>
                <textarea value={draft.content_html} onChange={(e) => set("content_html", e.target.value)} rows={14}
                  className={cn(inputCls, "font-mono text-xs")} placeholder="<p>Write your article here. Use <h2>, <p>, <ul><li>, <a href> …</p>" />
                <p className="mt-1 text-[11px] text-muted-foreground">Paste or write HTML. Supports headings, paragraphs, lists, links, images.</p>
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
            </div>

            <div className="flex justify-end gap-2 border-t border-border p-4">
              <button onClick={() => setDraft(null)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted">Cancel</button>
              <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} {editingSlug ? "Save changes" : "Publish"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
