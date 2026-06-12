"use client";

import { useEffect, useState, useCallback } from "react";
import { Mic, X, Loader2, CheckCircle2, AlertCircle, Phone, PhoneCall, TrendingUp, TrendingDown, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EnterpriseApplication } from "@/types/enterprise";

type VoiceStatus = "idle" | "calling" | "processing" | "complete" | "failed" | null;

const STATUS_LABEL: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  calling:    { label: "Calling candidate…",   color: "text-blue-400",  icon: PhoneCall },
  processing: { label: "Transcribing & scoring…", color: "text-amber-400", icon: Loader2 },
  complete:   { label: "Screening complete",   color: "text-green-400", icon: CheckCircle2 },
  failed:     { label: "Call failed",          color: "text-red-400",   icon: AlertCircle },
};

interface VoiceScreenModalProps {
  app: EnterpriseApplication;
  jobId: string;
  onClose: () => void;
  onUpdate: (patch: Partial<EnterpriseApplication>) => void;
}

export function VoiceScreenModal({ app, onClose, onUpdate }: VoiceScreenModalProps) {
  const [status, setStatus] = useState<VoiceStatus>(
    (app as unknown as Record<string, unknown>).voice_screen_status as VoiceStatus ?? "idle",
  );
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Poll for completion while calling/processing
  const poll = useCallback(async () => {
    const res = await fetch(`/api/enterprise/voice-screen/status?appId=${app.id}`);
    const json = await res.json();
    if (!json.data) return;
    const s = json.data.voice_screen_status as VoiceStatus;
    setStatus(s);
    if (s === "complete" || s === "failed") {
      onUpdate(json.data);
    }
  }, [app.id, onUpdate]);

  useEffect(() => {
    if (status !== "calling" && status !== "processing") return;
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [status, poll]);

  const startCall = async () => {
    const phone = (app as unknown as Record<string, unknown>).candidate_phone as string | null;
    if (!phone) { setError("No phone number on file for this candidate. Add it first."); return; }
    setLaunching(true);
    setError(null);
    const res = await fetch("/api/enterprise/voice-screen/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appId: app.id }),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error ?? "Failed to start call."); setLaunching(false); return; }
    setStatus("calling");
    setLaunching(false);
  };

  const appEx = app as unknown as Record<string, unknown>;
  const voiceScore = appEx.voice_score as number | null;
  const voiceSummary = appEx.voice_summary as string | null;
  const voiceTranscript = appEx.voice_transcript as string | null;
  const voiceQuestions = appEx.voice_questions as string[] | null;
  const voiceStrengths = appEx.voice_strengths as string[] | null;
  const voiceConcerns = appEx.voice_concerns as string[] | null;
  const voiceRec = appEx.voice_recommendation as string | null;
  const phone = appEx.candidate_phone as string | null;

  const scoreColor = voiceScore != null
    ? voiceScore >= 75 ? "text-green-400" : voiceScore >= 50 ? "text-amber-400" : "text-red-400"
    : "";

  const REC_COLORS: Record<string, string> = {
    advance: "border-green-500/30 bg-green-500/10 text-green-400",
    hold:    "border-amber-500/30 bg-amber-500/10 text-amber-400",
    reject:  "border-red-500/30 bg-red-500/10 text-red-400",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 backdrop-blur-sm p-4 pt-10">
      <div className="w-full max-w-xl rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2.5">
            <Mic className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-base font-bold">AI Voice Screening</h2>
              <p className="text-xs text-muted-foreground">{app.candidate_name} · {phone ?? "No phone"}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Status indicator */}
          {status && status !== "idle" && (
            <div className={cn("flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium",
              status === "complete" ? "border-green-500/30 bg-green-500/10" :
              status === "failed"   ? "border-red-500/30 bg-red-500/10" :
              "border-primary/30 bg-primary/10",
            )}>
              {(() => {
                const meta = STATUS_LABEL[status];
                const Icon = meta?.icon ?? Clock;
                const animate = status === "calling" || status === "processing";
                return (
                  <>
                    <Icon className={cn("h-4 w-4 shrink-0", meta?.color, animate && "animate-spin")} />
                    <span className={meta?.color}>{meta?.label}</span>
                  </>
                );
              })()}
            </div>
          )}

          {/* Results */}
          {status === "complete" && (
            <>
              {/* Score row */}
              <div className="flex items-center gap-4 rounded-xl bg-muted/40 px-4 py-3">
                {voiceScore != null && (
                  <div className="text-center">
                    <p className={cn("text-2xl font-bold tabular-nums", scoreColor)}>{voiceScore}%</p>
                    <p className="text-[10px] text-muted-foreground">Voice score</p>
                  </div>
                )}
                {voiceRec && (
                  <span className={cn("rounded-full border px-3 py-1 text-xs font-semibold capitalize", REC_COLORS[voiceRec] ?? "bg-muted text-muted-foreground border-border")}>
                    {voiceRec}
                  </span>
                )}
              </div>

              {/* Summary */}
              {voiceSummary && (
                <p className="text-sm leading-relaxed text-muted-foreground">{voiceSummary}</p>
              )}

              {/* Strengths + Concerns */}
              <div className="grid gap-3 sm:grid-cols-2">
                {voiceStrengths && voiceStrengths.length > 0 && (
                  <div>
                    <p className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-green-400">
                      <TrendingUp className="h-3 w-3" /> Strengths
                    </p>
                    <ul className="space-y-1">
                      {voiceStrengths.map((s, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />{s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {voiceConcerns && voiceConcerns.length > 0 && (
                  <div>
                    <p className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-amber-400">
                      <TrendingDown className="h-3 w-3" /> Concerns
                    </p>
                    <ul className="space-y-1">
                      {voiceConcerns.map((c, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />{c}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Questions asked */}
              {voiceQuestions && voiceQuestions.length > 0 && (
                <div className="rounded-xl border border-border bg-muted/30 p-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Questions asked</p>
                  <ol className="space-y-1.5 list-decimal pl-4">
                    {voiceQuestions.map((q, i) => (
                      <li key={i} className="text-xs text-muted-foreground">{q}</li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Transcript */}
              {voiceTranscript && (
                <details className="rounded-xl border border-border bg-muted/20">
                  <summary className="cursor-pointer px-3 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
                    View full transcript
                  </summary>
                  <p className="px-3 pb-3 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">{voiceTranscript}</p>
                </details>
              )}
            </>
          )}

          {/* Not started / failed — CTA */}
          {(status === "idle" || status === "failed" || status == null) && (
            <>
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-sm font-semibold">How it works</p>
                <ol className="mt-2 space-y-1.5 text-xs text-muted-foreground list-decimal pl-4">
                  <li>AI generates 4 role-specific screening questions</li>
                  <li>Candidate receives a call on their phone</li>
                  <li>An AI voice reads the questions and records their answers</li>
                  <li>OpenAI Whisper transcribes the response</li>
                  <li>GPT scores communication, fit, and gives a recommendation</li>
                </ol>
              </div>

              {!phone && (
                <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-400">
                  No phone number on file. Add one to the candidate&apos;s profile to enable voice screening.
                </p>
              )}

              {error && (
                <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs text-red-400">{error}</p>
              )}

              <button
                onClick={startCall}
                disabled={launching || !phone}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-brand py-3 text-sm font-semibold text-white shadow-glow disabled:opacity-60"
              >
                {launching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
                {launching ? "Initiating call…" : status === "failed" ? "Retry voice screen" : "Start AI voice screening"}
              </button>
            </>
          )}

          {/* Waiting states — no CTA */}
          {(status === "calling" || status === "processing") && (
            <p className="text-center text-xs text-muted-foreground">
              {status === "calling"
                ? "The candidate's phone is ringing. This page will update automatically when they answer and complete the screening."
                : "Audio received. Transcribing and scoring — usually takes 30–60 seconds."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
