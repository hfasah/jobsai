"use client";

import { useState } from "react";
import { Mail, Loader2, X, CheckCircle2, AlertCircle, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EnterpriseApplication } from "@/types/enterprise";

interface GmailComposeModalProps {
  apps: EnterpriseApplication[];
  onClose: () => void;
}

const TEMPLATES = [
  {
    label: "Interview invite",
    subject: "Interview invitation — {{job_title}}",
    body: "<p>Hi {{name}},</p><p>We'd love to invite you to interview for the <strong>{{job_title}}</strong> role. Please let us know your availability or use the link below to book a time that works for you.</p><p>Looking forward to speaking with you!</p>",
  },
  {
    label: "Application update",
    subject: "Update on your application — {{job_title}}",
    body: "<p>Hi {{name}},</p><p>Thank you for your interest in the <strong>{{job_title}}</strong> position. We're currently reviewing applications and will be in touch soon with next steps.</p>",
  },
  {
    label: "Offer ready",
    subject: "We have an offer for you — {{job_title}}",
    body: "<p>Hi {{name}},</p><p>Great news — we'd like to extend an offer for the <strong>{{job_title}}</strong> role! Please reply to this email or give us a call to discuss the details.</p>",
  },
  {
    label: "Request documents",
    subject: "Documents needed — {{job_title}}",
    body: "<p>Hi {{name}},</p><p>As part of the next stage for <strong>{{job_title}}</strong>, we'll need a few documents from you. Please reply with the following: [list items here].</p>",
  },
];

export function GmailComposeModal({ apps, onClose }: GmailComposeModalProps) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ name: string; email: string; ok: boolean; error?: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [templateOpen, setTemplateOpen] = useState(false);

  const applyTemplate = (t: typeof TEMPLATES[0]) => {
    setSubject(t.subject);
    setBody(t.body);
    setTemplateOpen(false);
  };

  const send = async () => {
    if (!subject.trim() || !body.trim()) return;
    setLoading(true);
    setError(null);

    const outcomes = await Promise.all(
      apps.map(async (app) => {
        const personalizedSubject = subject
          .replace(/\{\{name\}\}/g, app.candidate_name)
          .replace(/\{\{job_title\}\}/g, "the role");
        const personalizedBody = body
          .replace(/\{\{name\}\}/g, app.candidate_name)
          .replace(/\{\{job_title\}\}/g, "the role");

        const res = await fetch("/api/enterprise/gmail/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: app.candidate_email, subject: personalizedSubject, html: personalizedBody }),
        });
        const json = await res.json();
        return { name: app.candidate_name, email: app.candidate_email, ok: res.ok, error: json.error };
      })
    );
    setResults(outcomes);
    setLoading(false);
  };

  const sent = results?.filter((r) => r.ok).length ?? 0;
  const failed = results?.filter((r) => !r.ok).length ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 backdrop-blur-sm p-4 pt-10">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2.5">
            <Mail className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-base font-bold">Send via Gmail</h2>
              <p className="text-xs text-muted-foreground">
                {apps.length === 1 ? apps[0].candidate_name : `${apps.length} candidates`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {results ? (
            <>
              <div className={cn(
                "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium",
                failed === 0 ? "border-green-500/30 bg-green-500/10 text-green-400" : "border-amber-500/30 bg-amber-500/10 text-amber-400"
              )}>
                {failed === 0
                  ? <><CheckCircle2 className="h-4 w-4" /> {sent} email{sent !== 1 ? "s" : ""} sent successfully</>
                  : <><AlertCircle className="h-4 w-4" /> {sent} sent, {failed} failed</>}
              </div>
              {failed > 0 && (
                <div className="space-y-1">
                  {results.filter((r) => !r.ok).map((r) => (
                    <p key={r.email} className="text-xs text-destructive">{r.name}: {r.error}</p>
                  ))}
                  <p className="text-xs text-muted-foreground mt-1">
                    Make sure your Google Workspace account is connected in Settings → Integrations.
                  </p>
                </div>
              )}
              <button onClick={onClose} className="w-full rounded-xl border border-border py-2 text-sm font-medium hover:bg-muted">
                Close
              </button>
            </>
          ) : (
            <>
              {/* Template picker */}
              <div className="relative">
                <button onClick={() => setTemplateOpen((o) => !o)}
                  className="flex w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
                  Use a template
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", templateOpen && "rotate-180")} />
                </button>
                {templateOpen && (
                  <div className="absolute z-10 mt-1 w-full rounded-xl border border-border bg-card shadow-lg">
                    {TEMPLATES.map((t) => (
                      <button key={t.label} onClick={() => applyTemplate(t)}
                        className="flex w-full items-start px-3 py-2.5 text-left text-sm hover:bg-muted first:rounded-t-xl last:rounded-b-xl">
                        {t.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Subject */}
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Subject</label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Subject line"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Body */}
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Body <span className="text-muted-foreground/60">(HTML supported · use {"{{name}}"} for candidate name)</span>
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={6}
                  placeholder="<p>Hi {{name}},</p><p>…</p>"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none font-mono text-xs"
                />
              </div>

              {error && (
                <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>
              )}

              <button
                onClick={send}
                disabled={loading || !subject.trim() || !body.trim()}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-brand py-3 text-sm font-semibold text-white shadow-glow disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                {loading ? "Sending…" : `Send to ${apps.length} candidate${apps.length !== 1 ? "s" : ""}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
