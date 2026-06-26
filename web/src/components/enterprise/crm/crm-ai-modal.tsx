"use client";

import { useState } from "react";
import { X, Sparkles, Loader2, Copy, Check, Send } from "lucide-react";
import { cn } from "@/lib/utils";

const QUICK: { label: string; action: string }[] = [
  { label: "Summarize relationship", action: "summarize_company" },
  { label: "Next best action", action: "next_best_action" },
  { label: "Draft follow-up email", action: "draft_follow_up" },
  { label: "Draft client update", action: "draft_client_update" },
  { label: "Intake questions", action: "draft_intake_questions" },
  { label: "Score opportunity", action: "score_opportunity" },
  { label: "Candidate submission", action: "draft_candidate_submission" },
];

// "Ask AI about this client" — operates on a company. Quick actions + a free-form
// box (passed as extra detail for actions, or as the prompt for a free question).
export function CrmAiModal({ open, onClose, companyId, companyName }: { open: boolean; onClose: () => void; companyId: string; companyName: string }) {
  const [extra, setExtra] = useState("");
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const run = async (action: string, prompt?: string) => {
    setBusy(true); setError(""); setOutput(""); setCopied(false);
    try {
      const res = await fetch("/api/enterprise/crm/ai", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, company_id: companyId, extra: action === "ask" ? "" : extra, prompt }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Generation failed."); return; }
      setOutput(json.output ?? "");
    } finally { setBusy(false); }
  };

  const copy = () => { navigator.clipboard.writeText(output); setCopied(true); setTimeout(() => setCopied(false), 1800); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-2xl border border-border bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4 text-primary" /> Ask AI about {companyName}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          <div className="flex flex-wrap gap-1.5">
            {QUICK.map((q) => (
              <button key={q.action} onClick={() => run(q.action)} disabled={busy}
                className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50">
                {q.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <textarea value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Add details (e.g. candidate info) or ask anything about this client…"
              className="min-h-[64px] flex-1 resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <button onClick={() => run("ask", extra)} disabled={busy || !extra.trim()}
            className="btn-cta inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Ask
          </button>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {(busy || output) && (
            <div className="rounded-xl border border-border bg-background/60 p-4">
              {busy && !output ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Thinking…</div>
              ) : (
                <>
                  <div className="mb-2 flex justify-end">
                    <button onClick={copy} className={cn("inline-flex items-center gap-1 text-xs", copied ? "text-green-500" : "text-muted-foreground hover:text-foreground")}>
                      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">{output}</pre>
                </>
              )}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">AI uses only this client’s CRM data. Review before sending.</p>
        </div>
      </div>
    </div>
  );
}
