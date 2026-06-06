"use client";

import { useState, useEffect, useRef } from "react";
import {
  Sparkles, X, Loader2, Copy, Check, Bookmark, Trash2, Send, Plus, Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Prompt { id: string; title: string; prompt: string; uses: number }

const STARTERS = [
  "Write a LinkedIn post announcing a new role",
  "Draft a warm rejection email",
  "Generate a boolean search string for senior DevOps engineers",
  "Write an interview invite email",
];

export function AskAI() {
  const [open, setOpen] = useState(false);
  const [request, setRequest] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [copied, setCopied] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveTitle, setSaveTitle] = useState("");
  const [activePromptId, setActivePromptId] = useState<string | null>(null);
  const outRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && prompts.length === 0) {
      fetch("/api/enterprise/ai-prompts").then((r) => r.json()).then((j) => setPrompts(j.data ?? [])).catch(() => {});
    }
  }, [open, prompts.length]);

  const generate = async (text?: string, promptId?: string) => {
    const req = (text ?? request).trim();
    if (!req) return;
    setRequest(req);
    setActivePromptId(promptId ?? null);
    setLoading(true); setOutput("");
    try {
      const res = await fetch("/api/enterprise/ai-assistant", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request: req, prompt_id: promptId }),
      });
      const json = await res.json();
      setOutput(json.output ?? json.error ?? "No output.");
      setTimeout(() => outRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } finally { setLoading(false); }
  };

  const savePrompt = async () => {
    if (!saveTitle.trim() || !request.trim()) return;
    const res = await fetch("/api/enterprise/ai-prompts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: saveTitle, prompt: request }),
    });
    const json = await res.json();
    if (json.data) setPrompts((p) => [json.data, ...p]);
    setSaveTitle(""); setSaveOpen(false);
  };

  const deletePrompt = async (id: string) => {
    setPrompts((p) => p.filter((x) => x.id !== id));
    await fetch(`/api/enterprise/ai-prompts/${id}`, { method: "DELETE" });
  };

  return (
    <>
      {/* Launcher — top-right, clear of the support chat widget (bottom-right).
          Compact icon on mobile (fits the top header bar), full pill on desktop. */}
      <button onClick={() => setOpen(true)} aria-label="Ask AI"
        className="fixed right-3 top-2.5 z-[55] inline-flex items-center gap-2 rounded-full bg-gradient-brand px-2.5 py-2.5 text-sm font-semibold text-white shadow-glow-purple transition-transform hover:scale-105 md:right-5 md:top-4 md:px-4 md:py-3 print:hidden">
        <Sparkles className="h-4 w-4" />
        <span className="hidden md:inline">Ask AI</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex justify-end bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()}
            className="flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-2xl">
            {/* header */}
            <div className="flex items-center justify-between border-b border-border bg-gradient-brand px-5 py-4 text-white">
              <div className="flex items-center gap-2"><Wand2 className="h-5 w-5" /><div><p className="font-semibold">Ask AI</p><p className="text-[11px] opacity-80">Generate anything for your hiring workflow</p></div></div>
              <button onClick={() => setOpen(false)} className="rounded-md p-1 hover:bg-white/15"><X className="h-5 w-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Saved templates */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Saved prompts</p>
                </div>
                {prompts.length === 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {STARTERS.map((s) => (
                      <button key={s} onClick={() => generate(s)}
                        className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground">
                        {s}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {prompts.map((p) => (
                      <div key={p.id} className="group flex items-center gap-1.5">
                        <button onClick={() => generate(p.prompt, p.id)}
                          className="flex flex-1 items-center gap-2 rounded-lg border border-border px-3 py-2 text-left text-sm hover:bg-muted transition-colors">
                          <Bookmark className="h-3.5 w-3.5 shrink-0 text-primary" />
                          <span className="truncate">{p.title}</span>
                          {p.uses > 0 && <span className="ml-auto text-[10px] text-muted-foreground">{p.uses}×</span>}
                        </button>
                        <button onClick={() => deletePrompt(p.id)} className="rounded-md p-1.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Output */}
              {(loading || output) && (
                <div ref={outRef} className="rounded-xl border border-border bg-background/60 p-4">
                  {loading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Generating…</div>
                  ) : (
                    <>
                      <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{output}</pre>
                      <div className="mt-3 flex gap-2">
                        <button onClick={() => { navigator.clipboard.writeText(output); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted">
                          {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy"}
                        </button>
                        {!activePromptId && (
                          <button onClick={() => { setSaveTitle(request.slice(0, 40)); setSaveOpen(true); }}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted">
                            <Plus className="h-3.5 w-3.5" /> Save as prompt
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Save prompt form */}
              {saveOpen && (
                <div className="rounded-xl border border-border bg-background/60 p-3 space-y-2">
                  <p className="text-xs font-medium">Save this request for the whole team</p>
                  <input value={saveTitle} onChange={(e) => setSaveTitle(e.target.value)} placeholder="Prompt name"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  <div className="flex gap-2">
                    <button onClick={savePrompt} className="btn-cta rounded-lg px-3 py-1.5 text-xs font-semibold">Save</button>
                    <button onClick={() => setSaveOpen(false)} className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted">Cancel</button>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <form onSubmit={(e) => { e.preventDefault(); generate(); }} className="border-t border-border p-3">
              <div className="flex items-end gap-2">
                <textarea value={request} onChange={(e) => setRequest(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); generate(); } }}
                  placeholder="Ask the AI to write anything… (⌘+Enter)" rows={2}
                  className="flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground" />
                <button type="submit" disabled={loading || !request.trim()}
                  className="btn-cta flex h-10 w-10 items-center justify-center rounded-xl disabled:opacity-40">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
