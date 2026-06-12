"use client";

import { useState } from "react";
import { MessageSquare, Loader2, X, CheckCircle2, AlertCircle, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EnterpriseApplication } from "@/types/enterprise";

interface SmsModalProps {
  apps: EnterpriseApplication[];
  jobId: string;
  onClose: () => void;
}

type Channel = "sms" | "whatsapp";

const TEMPLATES = [
  { label: "Interview invite", text: "Hi {{name}}, we'd love to invite you for an interview! Please use this link to pick a time that works for you: {{booking_link}}" },
  { label: "Application update", text: "Hi {{name}}, thanks for applying! We're reviewing your application and will be in touch soon." },
  { label: "Offer ready", text: "Hi {{name}}, great news — we have an offer ready for you. Please check your email or reply to this message to discuss." },
  { label: "Next steps", text: "Hi {{name}}, just following up on your application. Are you still interested in the role? Reply YES to continue." },
];

export function SmsModal({ apps, jobId: _jobId, onClose }: SmsModalProps) {
  const [channel, setChannel] = useState<Channel>("sms");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ id: string; name: string; status: string; error?: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (!message.trim()) return;
    setLoading(true);
    setError(null);

    const res = await fetch("/api/enterprise/sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel, appIds: apps.map((a) => a.id), message }),
    });
    const json = await res.json();

    if (!res.ok && res.status === 422) {
      setError(json.error);
      setLoading(false);
      return;
    }

    setResults(json.results ?? []);
    setLoading(false);
  };

  const sent = results?.filter((r) => r.status === "sent").length ?? 0;
  const failed = results?.filter((r) => r.status === "failed").length ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 backdrop-blur-sm p-4 pt-10">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2.5">
            <MessageSquare className="h-5 w-5 text-primary" />
            <h2 className="text-base font-bold">Send Message</h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{apps.length} candidate{apps.length !== 1 ? "s" : ""}</span>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Channel selector */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Channel</p>
            <div className="inline-flex rounded-xl border border-border bg-muted/40 p-1 gap-1">
              {(["sms", "whatsapp"] as Channel[]).map((c) => (
                <button
                  key={c}
                  onClick={() => setChannel(c)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors capitalize",
                    channel === c ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {c === "whatsapp" ? (
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  ) : (
                    <Smartphone className="h-3.5 w-3.5" />
                  )}
                  {c === "whatsapp" ? "WhatsApp" : "SMS"}
                </button>
              ))}
            </div>
          </div>

          {/* Recipients */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recipients</p>
            <div className="flex flex-wrap gap-1.5">
              {apps.map((a) => (
                <span key={a.id} className="rounded-full bg-muted px-2.5 py-0.5 text-xs">{a.candidate_name}</span>
              ))}
            </div>
          </div>

          {/* Template chips */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quick templates</p>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATES.map((t) => (
                <button
                  key={t.label}
                  onClick={() => setMessage(t.text)}
                  className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Message input */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Message</p>
            <textarea
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message… Use {{name}} for candidate name."
              className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="mt-1 text-right text-[10px] text-muted-foreground">{message.length} chars</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Results */}
          {results && (
            <div className="rounded-xl border border-border bg-muted/30 p-3">
              <p className="mb-2 text-xs font-semibold">
                <span className="text-green-400">{sent} sent</span>
                {failed > 0 && <span className="ml-2 text-red-400">{failed} failed</span>}
              </p>
              <div className="space-y-1">
                {results.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 text-xs">
                    {r.status === "sent"
                      ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-400" />
                      : <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-400" />}
                    <span className="font-medium">{r.name}</span>
                    {r.error && <span className="text-muted-foreground">— {r.error}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!results && (
            <button
              onClick={send}
              disabled={loading || !message.trim()}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-brand py-3 text-sm font-semibold text-white shadow-glow disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
              {loading ? "Sending…" : `Send via ${channel === "whatsapp" ? "WhatsApp" : "SMS"}`}
            </button>
          )}
          {results && (
            <button onClick={onClose} className="w-full rounded-xl border border-border py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted">
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
