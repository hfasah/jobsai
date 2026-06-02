"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Mic, MicOff, ArrowLeft, Loader2,
  CheckCircle2, AlertCircle, ChevronRight,
  Star, Zap, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BuddyCoaching } from "@/app/api/jobs/[jobId]/interview-buddy/route";

// ─── Types ────────────────────────────────────────────────────────────────────

type SessionState = "idle" | "listening" | "processing" | "error";

interface CoachingEntry {
  id: number;
  transcript: string;
  coaching: BuddyCoaching;
  timestamp: Date;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ScoreStars({ score }: { score: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(
            "h-3.5 w-3.5",
            i <= score ? "fill-amber-400 text-amber-400" : "fill-muted text-muted"
          )}
        />
      ))}
    </div>
  );
}

// ─── Coaching card ────────────────────────────────────────────────────────────

function CoachingCard({
  entry,
  index,
  isLatest,
}: {
  entry: CoachingEntry;
  index: number;
  isLatest: boolean;
}) {
  const [expanded, setExpanded] = useState(isLatest);
  const c = entry.coaching;

  return (
    <div className={cn(
      "rounded-xl border transition-all",
      isLatest ? "border-primary/40 bg-card shadow-sm" : "border-border bg-card/60"
    )}>
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm text-muted-foreground">
            "{entry.transcript.slice(0, 60)}{entry.transcript.length > 60 ? "…" : ""}"
          </p>
        </div>
        <ScoreStars score={c.score} />
        <ChevronRight className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-90")} />
      </button>

      {/* Body */}
      {expanded && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
          {/* Strength */}
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-desyn-success" />
            <p className="text-sm text-foreground leading-relaxed">{c.strength}</p>
          </div>

          {/* Improvement */}
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <p className="text-sm text-foreground leading-relaxed">{c.improvement}</p>
          </div>

          {/* Missed points */}
          {c.missed_points.length > 0 && (
            <div className="rounded-lg bg-muted/50 px-3 py-2">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Could have mentioned</p>
              <ul className="space-y-1">
                {c.missed_points.map((p, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Strong phrases */}
          {c.strong_phrases.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {c.strong_phrases.map((phrase, i) => (
                <span key={i} className="rounded-full bg-desyn-success/10 px-2.5 py-0.5 text-xs font-medium text-desyn-success">
                  ✓ "{phrase}"
                </span>
              ))}
            </div>
          )}

          {/* Follow-up prep */}
          {c.follow_up_prep && (
            <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
              <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <p className="text-xs text-muted-foreground leading-relaxed">{c.follow_up_prep}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Mic pulse animation ──────────────────────────────────────────────────────

function MicPulse({ active }: { active: boolean }) {
  return (
    <div className="relative flex h-20 w-20 items-center justify-center">
      {active && (
        <>
          <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" style={{ animationDuration: "1.5s" }} />
          <div className="absolute inset-2 animate-ping rounded-full bg-primary/10" style={{ animationDuration: "2s" }} />
        </>
      )}
      <div className={cn(
        "relative flex h-14 w-14 items-center justify-center rounded-full transition-colors",
        active ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30" : "bg-muted text-muted-foreground"
      )}>
        {active ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

// Web Speech API types not in default TS lib — declare minimal shape
interface SpeechRecognitionEvent {
  resultIndex: number;
  results: { isFinal: boolean; 0: { transcript: string } }[];
}
interface SpeechRecognitionErrorEvent {
  error: string;
}
interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}
declare global {
  interface Window {
    SpeechRecognition: new () => ISpeechRecognition;
    webkitSpeechRecognition: new () => ISpeechRecognition;
  }
}

export default function InterviewBuddyPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = use(params);

  const [state, setState] = useState<SessionState>("idle");
  const [supported, setSupported] = useState(true);
  const [interimText, setInterimText] = useState("");
  const [finalText, setFinalText] = useState("");
  const [entries, setEntries] = useState<CoachingEntry[]>([]);
  const [sessionTime, setSessionTime] = useState(0);
  const [jobTitle, setJobTitle] = useState("");
  const [jobCompany, setJobCompany] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const entryCountRef = useRef(0);
  const accumulatedRef = useRef(""); // accumulates final segments between coaching calls

  // Load job title/company
  useEffect(() => {
    fetch(`/api/jobs/${jobId}`)
      .then((r) => r.json())
      .then((j) => {
        const p = j.data?.parsed;
        if (p?.title) setJobTitle(p.title);
        if (p?.company) setJobCompany(p.company);
      })
      .catch(() => null);
  }, [jobId]);

  // Check speech API support
  useEffect(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) setSupported(false);
  }, []);

  // Session timer
  useEffect(() => {
    if (state === "listening" || state === "processing") {
      sessionTimerRef.current = setInterval(() => setSessionTime((t) => t + 1), 1000);
    } else {
      if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
    }
    return () => { if (sessionTimerRef.current) clearInterval(sessionTimerRef.current); };
  }, [state]);

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // Get coaching for the accumulated transcript
  const getCoaching = useCallback(async (text: string) => {
    if (!text.trim() || text.trim().split(" ").length < 5) return;
    setState("processing");

    try {
      const res = await fetch(`/api/jobs/${jobId}/interview-buddy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: text }),
      });
      const json = await res.json();
      if (!res.ok || !json.data) throw new Error(json.error ?? "Coaching failed");

      const id = entryCountRef.current++;
      setEntries((prev) => [{ id, transcript: text, coaching: json.data, timestamp: new Date() }, ...prev]);
      setFinalText("");
      accumulatedRef.current = "";
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Coaching failed");
    } finally {
      setState("listening");
    }
  }, [jobId]);

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) return;

    const recognition: ISpeechRecognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let interim = "";
      let newFinal = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          newFinal += result[0].transcript + " ";
        } else {
          interim += result[0].transcript;
        }
      }

      if (newFinal) {
        accumulatedRef.current += newFinal;
        setFinalText(accumulatedRef.current);
        setInterimText("");

        // Debounce: 3s silence after final text → trigger coaching
        if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
        pauseTimerRef.current = setTimeout(() => {
          const text = accumulatedRef.current.trim();
          if (text) getCoaching(text);
        }, 3000);
      } else {
        setInterimText(interim);
      }
    };

    recognition.onerror = (event) => {
      if (event.error === "no-speech") return; // ignore silence errors
      if (event.error === "not-allowed") {
        setErrorMsg("Microphone access denied. Allow mic access in your browser settings.");
        setState("error");
        return;
      }
      console.error("Speech error:", event.error);
    };

    recognition.onend = () => {
      // Auto-restart unless we stopped intentionally
      if (recognitionRef.current === recognition && state !== "idle") {
        try { recognition.start(); } catch { /* already started */ }
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setState("listening");
    setErrorMsg(null);
  }, [getCoaching, state]);

  const stopListening = useCallback(() => {
    if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setInterimText("");
    setState("idle");
    // Flush any remaining text
    const remaining = accumulatedRef.current.trim();
    if (remaining && remaining.split(" ").length >= 5) {
      getCoaching(remaining);
    }
  }, [getCoaching]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
      if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
    };
  }, []);

  const isActive = state === "listening" || state === "processing";

  return (
    <div className="flex h-screen flex-col bg-background">

      {/* Top bar */}
      <div className="flex items-center gap-4 border-b border-border bg-card px-4 py-3 sm:px-6">
        <Link
          href={`/dashboard/jobs/${jobId}`}
          onClick={stopListening}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            Interview Buddy
            {jobTitle && <span className="font-normal text-muted-foreground"> · {jobTitle}{jobCompany ? ` @ ${jobCompany}` : ""}</span>}
          </p>
        </div>
        {isActive && (
          <span className="flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-destructive" />
            {formatTime(sessionTime)}
          </span>
        )}
        {isActive && (
          <Button variant="outline" size="sm" onClick={stopListening} className="border-destructive/40 text-destructive hover:bg-destructive/5">
            <X className="mr-1.5 h-3.5 w-3.5" />
            Stop
          </Button>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: live transcript + mic */}
        <div className="flex w-full flex-col items-center md:w-1/2 md:border-r md:border-border">

          {!supported ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
              <MicOff className="h-12 w-12 text-muted-foreground/40" />
              <div>
                <p className="font-semibold">Browser not supported</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Interview Buddy requires Chrome or Edge for speech recognition.
                </p>
              </div>
            </div>
          ) : state === "idle" && entries.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
              <MicPulse active={false} />
              <div className="max-w-xs">
                <h2 className="text-lg font-semibold">Ready to coach you</h2>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  When you start, speak your interview answers naturally. After each answer, AI gives instant feedback — score, strengths, and what to improve.
                </p>
              </div>
              <Button size="lg" onClick={startListening} className="gap-2">
                <Mic className="h-5 w-5" />
                Start listening
              </Button>
            </div>
          ) : (
            <div className="flex w-full flex-1 flex-col p-6 gap-5">
              {/* Mic + status */}
              <div className="flex items-center gap-4">
                <MicPulse active={state === "listening"} />
                <div>
                  {state === "listening" && (
                    <p className="text-sm font-medium text-foreground">Listening…</p>
                  )}
                  {state === "processing" && (
                    <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Coaching…
                    </p>
                  )}
                  {state === "idle" && (
                    <p className="text-sm text-muted-foreground">Paused</p>
                  )}
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {entries.length} answer{entries.length !== 1 ? "s" : ""} coached · {formatTime(sessionTime)}
                  </p>
                </div>
                {!isActive && (
                  <Button size="sm" onClick={startListening} className="ml-auto gap-1.5">
                    <Mic className="h-4 w-4" /> Resume
                  </Button>
                )}
              </div>

              {/* Live transcript */}
              <div className="min-h-32 flex-1 rounded-xl border border-border bg-muted/30 p-4">
                {errorMsg ? (
                  <p className="text-sm text-destructive">{errorMsg}</p>
                ) : (
                  <>
                    {finalText && (
                      <p className="text-sm leading-relaxed text-foreground">{finalText}</p>
                    )}
                    {interimText && (
                      <p className="text-sm leading-relaxed text-muted-foreground/60 italic">{interimText}</p>
                    )}
                    {!finalText && !interimText && (
                      <p className="text-sm text-muted-foreground/40 italic">
                        {state === "listening" ? "Start speaking — your words appear here…" : "Tap Resume to keep listening."}
                      </p>
                    )}
                  </>
                )}
              </div>

              <p className="text-center text-xs text-muted-foreground">
                AI coaches each answer after a 3-second pause
              </p>
            </div>
          )}
        </div>

        {/* Right: coaching history */}
        <div className="hidden md:flex md:w-1/2 flex-col overflow-hidden">
          <div className="border-b border-border px-5 py-3">
            <p className="text-sm font-semibold text-foreground">Coaching</p>
            <p className="text-xs text-muted-foreground">
              {entries.length === 0 ? "Feedback appears here after each answer" : `${entries.length} answer${entries.length !== 1 ? "s" : ""} reviewed`}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {entries.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <Zap className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">No answers yet</p>
                </div>
              </div>
            ) : (
              entries.map((entry, i) => (
                <CoachingCard
                  key={entry.id}
                  entry={entry}
                  index={entries.length - 1 - i}
                  isLatest={i === 0}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Mobile coaching panel */}
      {entries.length > 0 && (
        <div className="md:hidden border-t border-border bg-card">
          <div className="px-4 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Latest coaching
            </p>
            <CoachingCard
              entry={entries[0]}
              index={entries.length - 1}
              isLatest={true}
            />
          </div>
        </div>
      )}
    </div>
  );
}
