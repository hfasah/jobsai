"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Mic, ArrowLeft, Loader2, Volume2, Lock, Coins,
  CheckCircle2, AlertCircle, RotateCcw, ChevronRight, MessageSquareText, Cpu, Crown, Shuffle, Gauge, Sparkles, BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StatRing } from "@/components/ui/stat-ring";
import { TokenBalance } from "@/components/ui/token-balance";
import { AudioBars } from "@/components/ui/audio-bars";
import { UpgradePlansModal } from "@/components/upgrade-plans-modal";
import { saveInterviewSession, convertVoiceAnalysisToResponses } from "@/lib/interview-utils";
import type { InterviewType, Turn, VoiceAnalysis } from "@/app/api/jobs/[jobId]/voice-interview/route";

const TOKEN_PER_TURN = 60;

const TYPE_OPTIONS: { value: InterviewType; label: string; icon: React.ElementType }[] = [
  { value: "behavioral", label: "Behavioral", icon: MessageSquareText },
  { value: "technical",  label: "Technical",  icon: Cpu },
  { value: "leadership", label: "Leadership", icon: Crown },
  { value: "mixed",      label: "Mixed",      icon: Shuffle },
];

// ── Web Speech API minimal types ──────────────────────────────────────────────
interface SpeechRecognitionEvent { resultIndex: number; results: { isFinal: boolean; 0: { transcript: string } }[]; }
interface SpeechRecognitionErrorEvent { error: string; }
interface ISpeechRecognition extends EventTarget {
  continuous: boolean; interimResults: boolean; lang: string;
  start(): void; stop(): void;
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

type Phase = "preflight" | "speaking" | "listening" | "thinking" | "analyzing" | "results" | "blocked" | "error";

export default function VoiceInterviewPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = use(params);

  const [phase, setPhase] = useState<Phase>("preflight");
  const [supported, setSupported] = useState(true);
  const [interviewType, setInterviewType] = useState<InterviewType>("mixed");
  const [jobTitle, setJobTitle] = useState("");
  const [jobCompany, setJobCompany] = useState("");

  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<Turn[]>([]);
  const [interim, setInterim] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [trial, setTrial] = useState(false);
  const [mainNum, setMainNum] = useState(1);
  const [isFollowup, setIsFollowup] = useState(false);
  const [analysis, setAnalysis] = useState<VoiceAnalysis | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade] = useState<string | null>(null);

  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const answerRef = useRef("");          // accumulated final transcript for the current answer
  const turnRef = useRef(0);             // interviewer turns taken (mains + follow-ups)
  const mainRef = useRef(0);             // main (topic) questions asked
  const lastFollowupRef = useRef(false); // was the last interviewer turn a follow-up?
  const durationRef = useRef(0);         // total seconds spent answering
  const listenStartRef = useRef(0);
  const historyRef = useRef<Turn[]>([]); // mirror for async callbacks

  historyRef.current = history;

  // Load job + check speech support
  useEffect(() => {
    fetch(`/api/jobs/${jobId}`).then((r) => r.json()).then((j) => {
      const p = j.data?.parsed;
      if (p?.title) setJobTitle(p.title);
      if (p?.company) setJobCompany(p.company);
    }).catch(() => {});
    fetch("/api/tokens").then((r) => r.json()).then((j) => { if (j.data) setBalance(j.data.balance); }).catch(() => {});
    if (!(window.SpeechRecognition ?? window.webkitSpeechRecognition)) setSupported(false);
  }, [jobId]);

  // ── Speak a question via OpenAI TTS, then start listening ────────────────────
  const speak = useCallback(async (text: string) => {
    setPhase("speaking");
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error("tts");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { URL.revokeObjectURL(url); startListening(); };
      audio.onerror = () => { URL.revokeObjectURL(url); startListening(); };
      await audio.play().catch(() => startListening()); // autoplay blocked → just listen
    } catch {
      startListening(); // TTS failed → show text + listen
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const replay = useCallback(() => { audioRef.current?.play().catch(() => {}); }, []);

  // ── Mic capture ──────────────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }

    answerRef.current = "";
    setInterim("");
    listenStartRef.current = Date.now();

    const recognition: ISpeechRecognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) answerRef.current += result[0].transcript + " ";
        else interimText += result[0].transcript;
      }
      setInterim(interimText);
    };
    recognition.onerror = (e) => {
      if (e.error === "not-allowed") { setErrorMsg("Microphone access denied. Allow mic access and reload."); setPhase("error"); }
    };
    recognition.onend = () => {
      if (recognitionRef.current === recognition) {
        try { recognition.start(); } catch { /* restarting */ }
      }
    };

    recognitionRef.current = recognition;
    try { recognition.start(); } catch { /* already started */ }
    setPhase("listening");
  }, []);

  const stopListening = useCallback(() => {
    durationRef.current += (Date.now() - listenStartRef.current) / 1000;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setInterim("");
  }, []);

  // ── Flow control ─────────────────────────────────────────────────────────────
  const start = useCallback(async () => {
    setErrorMsg(null);
    setPhase("thinking");
    const res = await fetch(`/api/jobs/${jobId}/voice-interview`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start", interview_type: interviewType }),
    });
    const json = await res.json();
    if (res.status === 403 || res.status === 402) { setShowUpgrade(json.error ?? "Upgrade to use the Voice Interviewer."); return; }
    if (!res.ok) { setErrorMsg(json.error ?? "Could not start."); setPhase("error"); return; }

    turnRef.current = 1;
    mainRef.current = 1;
    lastFollowupRef.current = false;
    setMainNum(1);
    setIsFollowup(false);
    setTrial(!!json.data.trial);
    if (typeof json.data.balance === "number") setBalance(json.data.balance);
    setQuestion(json.data.question);
    setHistory([{ role: "interviewer", content: json.data.question }]);
    speak(json.data.question);
  }, [jobId, interviewType, speak]);

  const submitAnswer = useCallback(async () => {
    stopListening();
    const answer = (answerRef.current + interim).trim();
    if (!answer) { startListening(); return; }

    const newHistory: Turn[] = [...historyRef.current, { role: "candidate", content: answer }];
    setHistory(newHistory);
    setPhase("thinking");

    const res = await fetch(`/api/jobs/${jobId}/voice-interview`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "respond", interview_type: interviewType, history: newHistory, main_count: mainRef.current, followup_just_asked: lastFollowupRef.current, total_turns: turnRef.current }),
    });
    const json = await res.json();

    if (typeof json.balance === "number") setBalance(json.balance);
    if (json.data?.balance !== undefined) setBalance(json.data.balance);

    // Free preview over → upgrade wall (don't analyze a one-question teaser).
    if (json.data?.preview_over) {
      stopListening();
      setPhase("preflight");
      setShowUpgrade(json.data.message ?? "Upgrade to run the full voice interview.");
      return;
    }
    if (json.data?.done || res.status === 402) {
      finish(newHistory);
      return;
    }
    if (!res.ok) { setErrorMsg(json.error ?? "Something went wrong."); setPhase("error"); return; }

    turnRef.current += 1;
    if (json.data.kind === "followup") {
      lastFollowupRef.current = true;
      setIsFollowup(true);
    } else {
      mainRef.current += 1;
      lastFollowupRef.current = false;
      setMainNum(mainRef.current);
      setIsFollowup(false);
    }
    const q: string = json.data.question;
    setQuestion(q);
    setHistory([...newHistory, { role: "interviewer", content: q }]);
    speak(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, interviewType, interim, speak, stopListening, startListening]);

  const finish = useCallback(async (finalHistory: Turn[]) => {
    setPhase("analyzing");
    const res = await fetch(`/api/jobs/${jobId}/voice-interview`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "analyze", interview_type: interviewType, history: finalHistory,
        duration_sec: Math.round(durationRef.current),
        tokens_spent: turnRef.current * TOKEN_PER_TURN,
      }),
    });
    const json = await res.json();
    if (!res.ok) { setErrorMsg(json.error ?? "Analysis failed."); setPhase("error"); return; }
    setAnalysis(json.data);
    setPhase("results");
  }, [jobId, interviewType]);

  const endEarly = useCallback(() => {
    stopListening();
    const answer = (answerRef.current + interim).trim();
    const finalHistory = answer ? [...historyRef.current, { role: "candidate" as const, content: answer }] : historyRef.current;
    if (finalHistory.filter((t) => t.role === "candidate").length === 0) {
      // nothing answered yet — just leave
      setPhase("preflight");
      return;
    }
    finish(finalHistory);
  }, [interim, stopListening, finish]);

  // Cleanup
  useEffect(() => () => {
    recognitionRef.current?.stop();
    audioRef.current?.pause();
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="relative flex min-h-screen flex-col bg-mesh">
      {/* Top bar */}
      <div className="flex items-center gap-4 border-b border-border bg-card/70 px-4 py-3 backdrop-blur-xl sm:px-6">
        <Link href={`/dashboard/jobs/${jobId}`} onClick={() => { recognitionRef.current?.stop(); audioRef.current?.pause(); }}
          className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            AI Voice Interviewer
            {jobTitle && <span className="font-normal text-muted-foreground"> · {jobTitle}{jobCompany ? ` @ ${jobCompany}` : ""}</span>}
          </p>
        </div>
        <TokenBalance value={balance ?? undefined} />
      </div>

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 py-10 sm:px-6">

        {/* Preflight */}
        {phase === "preflight" && (
          <div className="w-full space-y-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-brand text-white shadow-glow">
              <Mic className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Live voice interview</h1>
              <p className="mt-2 text-muted-foreground">
                A real spoken conversation — the AI asks, listens, and follows up. Speak naturally; we&apos;ll score your delivery at the end.
              </p>
            </div>

            {!supported ? (
              <div className="rounded-xl border border-desyn-warning/30 bg-desyn-warning/15 p-4 text-sm text-desyn-warning">
                Voice interviews need Chrome or Edge for speech recognition.
              </div>
            ) : (
              <>
                <div className="flex flex-wrap justify-center gap-2">
                  {TYPE_OPTIONS.map(({ value, label, icon: Icon }) => (
                    <button key={value} onClick={() => setInterviewType(value)}
                      className={cn("inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                        interviewType === value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground")}>
                      <Icon className="h-3.5 w-3.5" /> {label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Up to 5 questions plus follow-ups · {TOKEN_PER_TURN} tokens each
                </p>
                <Button size="lg" className="w-full gap-2" onClick={start}>
                  <Mic className="h-5 w-5" /> Start interview
                </Button>
              </>
            )}
          </div>
        )}

        {/* Blocked (trial used / out of tokens) */}
        {phase === "blocked" && (
          <div className="w-full max-w-md space-y-5 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <Lock className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-xl font-bold">Unlock voice interviews</h2>
            <p className="text-muted-foreground">{errorMsg}</p>
            <Link href="/dashboard/billing" className="inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-6 py-3 text-sm font-semibold text-white shadow-glow">
              <Coins className="h-4 w-4" /> See plans & tokens
            </Link>
          </div>
        )}

        {/* Active conversation */}
        {(phase === "speaking" || phase === "listening" || phase === "thinking") && (
          <div className="w-full space-y-7">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {isFollowup
                  ? <span className="font-medium text-primary">Follow-up question</span>
                  : `Question ${mainNum} of 5`}
              </span>
              {trial && <span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">Free trial</span>}
            </div>

            {/* Interviewer */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <div className="flex items-center gap-3">
                <div className={cn("flex h-11 w-11 items-center justify-center rounded-full bg-gradient-brand text-white", phase === "speaking" && "animate-pulse-ring")}>
                  <Volume2 className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-muted-foreground">Interviewer</p>
                  {phase === "speaking" && <AudioBars bars={9} className="mt-1 h-4" />}
                </div>
                {phase === "speaking" && (
                  <button onClick={replay} className="text-xs text-muted-foreground hover:text-foreground">replay</button>
                )}
              </div>
              <p className="mt-4 text-lg font-medium leading-snug">{question}</p>
            </div>

            {/* Candidate / mic */}
            {phase === "thinking" ? (
              <div className="flex items-center justify-center gap-3 rounded-2xl border border-border bg-card p-8 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin text-primary" /> Thinking…
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-card p-6">
                <div className="flex items-center gap-3">
                  <div className={cn("relative flex h-11 w-11 items-center justify-center rounded-full transition-colors",
                    phase === "listening" ? "bg-destructive text-white" : "bg-muted text-muted-foreground")}>
                    {phase === "listening" && <span className="absolute inset-0 animate-ping rounded-full bg-destructive/30" />}
                    <Mic className="relative h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium">
                    {phase === "listening" ? "Listening — answer out loud" : "Preparing…"}
                  </p>
                </div>
                <div className="mt-4 min-h-16 rounded-xl bg-muted/40 p-4 text-sm leading-relaxed">
                  {(answerRef.current || interim)
                    ? <span>{answerRef.current}<span className="text-muted-foreground/60 italic">{interim}</span></span>
                    : <span className="text-muted-foreground/40 italic">Your answer appears here as you speak…</span>}
                </div>
                {phase === "listening" && (
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <Button variant="outline" size="sm" onClick={endEarly} className="text-muted-foreground">
                      End & analyze
                    </Button>
                    <Button onClick={submitAnswer} className="gap-1.5">
                      Done answering <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Analyzing */}
        {phase === "analyzing" && (
          <div className="flex flex-col items-center gap-4 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analyzing your delivery and answers…</p>
          </div>
        )}

        {/* Results */}
        {phase === "results" && analysis && (
          <VoiceResults
            analysis={analysis}
            jobTitle={jobTitle}
            history={history}
            onRestart={() => {
              setHistory([]); setAnalysis(null); setQuestion(""); turnRef.current = 0; durationRef.current = 0;
              answerRef.current = ""; setInterim(""); setPhase("preflight");
            }}
          />
        )}

        {/* Error */}
        {phase === "error" && (
          <div className="w-full max-w-md space-y-4 text-center">
            <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
            <p className="text-sm text-muted-foreground">{errorMsg ?? "Something went wrong."}</p>
            <Button variant="outline" onClick={() => setPhase("preflight")}>Try again</Button>
          </div>
        )}
      </div>

      {showUpgrade && <UpgradePlansModal reason={showUpgrade} onClose={() => setShowUpgrade(null)} />}
    </div>
  );
}

// ── Results screen ─────────────────────────────────────────────────────────────
function VoiceResults({
  analysis,
  jobTitle,
  history,
  onRestart,
}: {
  analysis: VoiceAnalysis;
  jobTitle: string;
  history: Turn[];
  onRestart: () => void;
}) {
  const router = useRouter();
  const [savingReport, setSavingReport] = useState(false);

  const handleSaveReport = async () => {
    setSavingReport(true);
    try {
      // Filter to only candidate answers
      const candidateAnswers = history.filter((t) => t.role === "candidate");
      const interviewerQuestions = history.filter((t) => t.role === "interviewer");

      // Convert to response format
      const responses = candidateAnswers.map((answer, idx) => ({
        question_number: idx + 1,
        question: interviewerQuestions[idx]?.content || `Question ${idx + 1}`,
        user_answer: answer.content,
        star_score: Math.round((analysis.behavioral / 100) * 100), // behavioral ≈ STAR adherence
        clarity_score: analysis.communication,
        technical_score: analysis.technical,
        confidence_score: analysis.confidence,
        ai_feedback: `${analysis.summary || "Good response."}`,
      }));

      const sessionId = await saveInterviewSession({
        job_title: jobTitle || "Voice Interview Practice",
        mode: "voice",
        responses,
      });

      router.push(`/dashboard/interview/results/${sessionId}`);
    } catch (err) {
      console.error("Failed to save report:", err);
      alert("Failed to save report. Please try again.");
      setSavingReport(false);
    }
  };

  const dims: { label: string; value: number }[] = [
    { label: "Communication", value: analysis.communication },
    { label: "Technical", value: analysis.technical },
    { label: "Behavioral", value: analysis.behavioral },
    { label: "Confidence", value: analysis.confidence },
  ];
  const tone = analysis.overall >= 4 ? "success" : analysis.overall >= 3 ? "warning" : "brand";

  // Honesty guard: don't dress up fabricated scores as a real assessment when
  // we barely captured any spoken answer.
  const candidateWords = history
    .filter((t) => t.role === "candidate")
    .reduce((n, t) => n + t.content.trim().split(/\s+/).filter(Boolean).length, 0);
  const lowSignal = candidateWords < 25;

  return (
    <div className="w-full space-y-5">
      {lowSignal && (
        <div className="flex gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-400" />
          <div>
            <p className="font-semibold text-amber-300">We couldn&apos;t capture enough to score this reliably</p>
            <p className="mt-1 text-amber-200/80">
              We only picked up {candidateWords} word{candidateWords === 1 ? "" : "s"} of spoken answers, so the numbers below are rough estimates — not a real assessment. Check that your microphone is on and answer each question out loud, then run it again for an accurate report.
            </p>
          </div>
        </div>
      )}
      <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-soft">
        <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Voice interview complete</p>
        <div className="mt-5 flex justify-center">
          <StatRing value={(analysis.overall / 5) * 100} label={`${analysis.overall}`} sublabel="of 5" tone={tone} size={150} />
        </div>
        {analysis.summary && <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground">{analysis.summary}</p>}
      </div>

      {/* Speaking metrics */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Gauge className="h-3.5 w-3.5" /> Speaking pace</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{analysis.speaking_pace.wpm}<span className="text-sm font-normal text-muted-foreground"> wpm</span></p>
          <p className="text-xs text-muted-foreground">{analysis.speaking_pace.label}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Sparkles className="h-3.5 w-3.5" /> Filler words</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{analysis.filler_words.count}<span className="text-sm font-normal text-muted-foreground"> · {analysis.filler_words.per_min}/min</span></p>
          <p className="truncate text-xs text-muted-foreground">{analysis.filler_words.examples.length ? analysis.filler_words.examples.map((e) => `"${e}"`).join(", ") : "None detected — clean!"}</p>
        </div>
      </div>

      {/* Dimension bars */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
          {dims.map(({ label, value }) => {
            const v = Math.max(0, Math.min(100, Math.round(value)));
            const tone = v >= 75 ? "bg-desyn-success" : v >= 50 ? "bg-amber-500" : "bg-destructive";
            return (
              <div key={label}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-semibold tabular-nums">{v}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className={cn("h-full rounded-full transition-all duration-700", tone)} style={{ width: `${v}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Strengths + improvements */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-desyn-success/30 bg-desyn-success/5 p-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-desyn-success">
            <CheckCircle2 className="h-3.5 w-3.5" /> Strengths
          </p>
          <ul className="space-y-1.5">
            {analysis.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-desyn-success" />{s}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-desyn-warning/30 bg-desyn-warning/15 p-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-desyn-warning">
            <AlertCircle className="h-3.5 w-3.5" /> Improve
          </p>
          <ul className="space-y-1.5">
            {analysis.improvements.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />{s}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex justify-center gap-3">
        <Button
          variant="outline"
          onClick={onRestart}
          disabled={savingReport}
        >
          <RotateCcw className="mr-1.5 h-4 w-4" /> Practice again
        </Button>
        <Button
          onClick={handleSaveReport}
          disabled={savingReport}
          className="gap-2"
        >
          {savingReport && <Loader2 className="h-4 w-4 animate-spin" />}
          <BarChart3 className="h-4 w-4" />
          View Detailed Report
        </Button>
      </div>
    </div>
  );
}
