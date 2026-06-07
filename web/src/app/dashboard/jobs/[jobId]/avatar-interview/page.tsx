"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Video, VideoOff, ArrowLeft, Loader2, Volume2, Lock, Coins, Camera,
  CheckCircle2, AlertCircle, RotateCcw, ChevronRight, Eye, Gauge, Sparkles, Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StatRing } from "@/components/ui/stat-ring";
import { TokenBalance } from "@/components/ui/token-balance";
import { AudioBars } from "@/components/ui/audio-bars";
import { PERSONAS, type AvatarPersona } from "@/lib/avatar";
import { UpgradePlansModal } from "@/components/upgrade-plans-modal";
import type { Turn, AvatarAnalysis, BodyLanguage } from "@/app/api/jobs/[jobId]/avatar-interview/route";

const TOKEN_PER_TURN = 250;
const PERSONA_KEYS = Object.keys(PERSONAS) as AvatarPersona[];

// ── Web Speech + FaceDetector minimal types ───────────────────────────────────
interface SpeechRecognitionEvent { resultIndex: number; results: { isFinal: boolean; 0: { transcript: string } }[]; }
interface SpeechRecognitionErrorEvent { error: string; }
interface ISpeechRecognition extends EventTarget {
  continuous: boolean; interimResults: boolean; lang: string;
  start(): void; stop(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}
interface DetectedFace { boundingBox: { x: number; y: number; width: number; height: number }; }
interface IFaceDetector { detect(source: CanvasImageSource): Promise<DetectedFace[]>; }
declare global {
  interface Window {
    SpeechRecognition: new () => ISpeechRecognition;
    webkitSpeechRecognition: new () => ISpeechRecognition;
    FaceDetector?: new (opts?: { fastMode?: boolean }) => IFaceDetector;
  }
}

type Phase = "preflight" | "speaking" | "listening" | "thinking" | "analyzing" | "results" | "blocked" | "error";

// Minimal structural view of the LiveAvatar Web SDK session (loaded lazily) —
// avoids importing the SDK (and its browser globals) at module scope.
interface LiveAvatarSdkSession {
  on(event: string, cb: (...args: unknown[]) => void): void;
  start(): Promise<void>;
  stop(): Promise<void>;
  attach(element: HTMLMediaElement): void;
  repeatAudio(audio: string): string; // LITE: lip-sync to our own PCM audio
  interrupt(): void;
}

export default function AvatarInterviewPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = use(params);

  const [phase, setPhase] = useState<Phase>("preflight");
  const [supported, setSupported] = useState(true);
  const [persona, setPersona] = useState<AvatarPersona>("hiring_manager");
  const [jobTitle, setJobTitle] = useState("");
  const [jobCompany, setJobCompany] = useState("");

  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<Turn[]>([]);
  const [interim, setInterim] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [trial, setTrial] = useState(false);
  const [mainNum, setMainNum] = useState(1);
  const [isFollowup, setIsFollowup] = useState(false);
  const [analysis, setAnalysis] = useState<AvatarAnalysis | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [faceSupported, setFaceSupported] = useState(false);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);

  const [avatarActive, setAvatarActive] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState<string | null>(null);

  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // LiveAvatar streaming session (LITE mode)
  const avatarSessionRef = useRef<LiveAvatarSdkSession | null>(null);
  const avatarVideoRef = useRef<HTMLVideoElement | null>(null);
  const startListeningRef = useRef<() => void>(() => {});
  const avatarInitedRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const selfVideoRef = useRef<HTMLVideoElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const faceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const faceStatsRef = useRef({ total: 0, presence: 0, eye: 0, steady: 0, lastX: -1 });
  const voiceRef = useRef<string>("onyx");
  const answerRef = useRef("");
  const turnRef = useRef(0);
  const mainRef = useRef(0);
  const lastFollowupRef = useRef(false);
  const durationRef = useRef(0);
  const listenStartRef = useRef(0);
  const historyRef = useRef<Turn[]>([]);
  historyRef.current = history;

  useEffect(() => {
    fetch(`/api/jobs/${jobId}`).then((r) => r.json()).then((j) => {
      const p = j.data?.parsed;
      if (p?.title) setJobTitle(p.title);
      if (p?.company) setJobCompany(p.company);
    }).catch(() => {});
    fetch("/api/tokens").then((r) => r.json()).then((j) => { if (j.data) setBalance(j.data.balance); }).catch(() => {});
    if (!(window.SpeechRecognition ?? window.webkitSpeechRecognition)) setSupported(false);
    setFaceSupported(typeof window.FaceDetector === "function");
  }, [jobId]);

  // attach stream to self-view whenever it's ready / video remounts
  useEffect(() => {
    if (cameraReady && selfVideoRef.current && streamRef.current) {
      selfVideoRef.current.srcObject = streamRef.current;
      selfVideoRef.current.play().catch(() => {});
    }
  }, [cameraReady, phase]);

  const enableCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: true });
      streamRef.current = stream;
      setCameraReady(true);
    } catch {
      setErrorMsg("Camera/mic access denied. You can still continue, but body-language analysis and recording need camera access.");
      setCameraReady(false);
    }
  }, []);

  // ── eye-contact sampling ─────────────────────────────────────────────────────
  const startFaceSampling = useCallback(() => {
    if (!faceSupported || !window.FaceDetector || !selfVideoRef.current) return;
    const detector = new window.FaceDetector({ fastMode: true });
    faceTimerRef.current = setInterval(async () => {
      const v = selfVideoRef.current;
      if (!v || v.readyState < 2) return;
      try {
        const faces = await detector.detect(v);
        const s = faceStatsRef.current;
        s.total += 1;
        if (faces.length) {
          s.presence += 1;
          const f = faces[0].boundingBox;
          const cx = (f.x + f.width / 2) / (v.videoWidth || 1);
          // centered horizontally (proxy for eye contact)
          if (cx > 0.3 && cx < 0.7) s.eye += 1;
          if (s.lastX >= 0 && Math.abs(cx - s.lastX) < 0.06) s.steady += 1;
          s.lastX = cx;
        }
      } catch { /* detector hiccup — skip sample */ }
    }, 1200);
  }, [faceSupported]);

  const stopFaceSampling = useCallback(() => {
    if (faceTimerRef.current) { clearInterval(faceTimerRef.current); faceTimerRef.current = null; }
  }, []);

  function computeBodyLanguage(): BodyLanguage {
    const s = faceStatsRef.current;
    if (!faceSupported || s.total === 0) {
      return { eye_contact: null, presence: null, steadiness: null, available: false };
    }
    const pct = (n: number) => Math.round((n / s.total) * 100);
    return {
      eye_contact: pct(s.eye),
      presence: pct(s.presence),
      steadiness: s.presence ? Math.round((s.steady / s.presence) * 100) : 0,
      available: true,
    };
  }

  // ── recording ────────────────────────────────────────────────────────────────
  const startRecording = useCallback(() => {
    if (!streamRef.current) return;
    try {
      chunksRef.current = [];
      const rec = new MediaRecorder(streamRef.current);
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        if (chunksRef.current.length) {
          const blob = new Blob(chunksRef.current, { type: chunksRef.current[0].type || "video/webm" });
          setRecordedUrl(URL.createObjectURL(blob));
        }
      };
      rec.start();
      recorderRef.current = rec;
    } catch { /* recording unsupported — non-fatal */ }
  }, []);

  const stopRecording = useCallback(() => {
    try { recorderRef.current?.stop(); } catch { /* already stopped */ }
    recorderRef.current = null;
  }, []);

  // ── LiveAvatar LITE: lazy-init the streaming session (once) ───────────────────
  const ensureAvatar = useCallback(async (p: AvatarPersona): Promise<boolean> => {
    if (avatarInitedRef.current) return !!avatarSessionRef.current;
    avatarInitedRef.current = true;
    try {
      const res = await fetch(`/api/avatar/session?persona=${encodeURIComponent(p)}`);
      const { data } = await res.json();
      if (!data?.configured || data.provider !== "liveavatar" || !data.sessionToken) return false;

      const mod = await import("@heygen/liveavatar-web-sdk");
      const { LiveAvatarSession, SessionEvent, AgentEventsEnum } = mod;
      const session = new LiveAvatarSession(data.sessionToken, { voiceChat: false }) as unknown as LiveAvatarSdkSession;

      session.on(SessionEvent.SESSION_STREAM_READY, () => {
        if (avatarVideoRef.current) session.attach(avatarVideoRef.current);
      });
      // The avatar finishing its line is our cue to start listening.
      session.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, () => startListeningRef.current?.());

      await session.start();
      avatarSessionRef.current = session;
      setAvatarActive(true);
      return true;
    } catch (e) {
      console.error("LiveAvatar init failed — falling back to simulated:", e);
      return false;
    }
  }, []);

  // ── Speak: LiveAvatar lip-syncs our PCM audio (LITE); else plain OpenAI TTS ────
  const speak = useCallback(async (text: string) => {
    setPhase("speaking");
    if (avatarSessionRef.current) {
      try {
        const res = await fetch("/api/tts", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voice: voiceRef.current, format: "pcm" }),
        });
        const { audio } = await res.json();
        if (audio) { avatarSessionRef.current.repeatAudio(audio); return; } // AVATAR_SPEAK_ENDED → listen
        startListeningRef.current();
      } catch { startListeningRef.current(); }
      return;
    }
    try {
      const res = await fetch("/api/tts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: voiceRef.current }),
      });
      if (!res.ok) throw new Error("tts");
      const url = URL.createObjectURL(await res.blob());
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { URL.revokeObjectURL(url); startListening(); };
      audio.onerror = () => { URL.revokeObjectURL(url); startListening(); };
      await audio.play().catch(() => startListening());
    } catch { startListening(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const replay = useCallback(() => { audioRef.current?.play().catch(() => {}); }, []);

  // ── mic ─────────────────────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }
    answerRef.current = ""; setInterim(""); listenStartRef.current = Date.now();
    startFaceSampling();

    const recognition: ISpeechRecognition = new SR();
    recognition.continuous = true; recognition.interimResults = true; recognition.lang = "en-US";
    recognition.onresult = (event) => {
      let it = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) answerRef.current += r[0].transcript + " "; else it += r[0].transcript;
      }
      setInterim(it);
    };
    recognition.onerror = (e) => {
      if (e.error === "not-allowed") { setErrorMsg("Microphone access denied."); setPhase("error"); }
    };
    recognition.onend = () => {
      if (recognitionRef.current === recognition) { try { recognition.start(); } catch { /* restart */ } }
    };
    recognitionRef.current = recognition;
    try { recognition.start(); } catch { /* started */ }
    setPhase("listening");
  }, [startFaceSampling]);

  // Keep a stable ref so the HeyGen AVATAR_STOP_TALKING handler can start the mic.
  useEffect(() => { startListeningRef.current = startListening; }, [startListening]);

  const stopListening = useCallback(() => {
    durationRef.current += (Date.now() - listenStartRef.current) / 1000;
    stopFaceSampling();
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setInterim("");
  }, [stopFaceSampling]);

  // ── flow ──────────────────────────────────────────────────────────────────────
  const start = useCallback(async () => {
    setErrorMsg(null); setPhase("thinking");
    voiceRef.current = PERSONAS[persona].voice;
    const res = await fetch(`/api/jobs/${jobId}/avatar-interview`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start", persona }),
    });
    const json = await res.json();
    if (res.status === 403 || res.status === 402) { setShowUpgrade(json.error ?? "Upgrade to use the Avatar Room."); return; }
    if (!res.ok) { setErrorMsg(json.error ?? "Could not start."); setPhase("error"); return; }

    turnRef.current = 1;
    mainRef.current = 1;
    lastFollowupRef.current = false;
    setMainNum(1);
    setIsFollowup(false);
    setTrial(!!json.data.trial);
    if (typeof json.data.balance === "number") setBalance(json.data.balance);
    if (json.data.voice) voiceRef.current = json.data.voice;
    startRecording();
    setQuestion(json.data.question);
    setHistory([{ role: "interviewer", content: json.data.question }]);
    await ensureAvatar(persona); // spin up the LiveAvatar (no-op if not configured)
    speak(json.data.question);
  }, [jobId, persona, speak, startRecording, ensureAvatar]);

  const submitAnswer = useCallback(async () => {
    stopListening();
    const answer = (answerRef.current + interim).trim();
    if (!answer) { startListening(); return; }
    const newHistory: Turn[] = [...historyRef.current, { role: "candidate", content: answer }];
    setHistory(newHistory); setPhase("thinking");

    const res = await fetch(`/api/jobs/${jobId}/avatar-interview`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "respond", persona, history: newHistory, main_count: mainRef.current, followup_just_asked: lastFollowupRef.current, total_turns: turnRef.current }),
    });
    const json = await res.json();
    if (typeof json.balance === "number") setBalance(json.balance);
    if (json.data?.balance !== undefined) setBalance(json.data.balance);
    // Free preview over → upgrade wall (stop the avatar, don't analyze).
    if (json.data?.preview_over) {
      avatarSessionRef.current?.stop().catch(() => {});
      stopListening();
      setPhase("preflight");
      setShowUpgrade(json.data.message ?? "Upgrade to run the full avatar interview.");
      return;
    }
    if (json.data?.done || res.status === 402) { finish(newHistory); return; }
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
  }, [jobId, persona, interim, speak, stopListening, startListening]);

  const finish = useCallback(async (finalHistory: Turn[]) => {
    setPhase("analyzing");
    stopFaceSampling();
    stopRecording();
    const res = await fetch(`/api/jobs/${jobId}/avatar-interview`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "analyze", persona, history: finalHistory,
        duration_sec: Math.round(durationRef.current),
        body_language: computeBodyLanguage(),
        tokens_spent: turnRef.current * TOKEN_PER_TURN,
      }),
    });
    const json = await res.json();
    // release the camera now that we're done
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (!res.ok) { setErrorMsg(json.error ?? "Analysis failed."); setPhase("error"); return; }
    setAnalysis(json.data); setPhase("results");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, persona, stopFaceSampling, stopRecording]);

  const endEarly = useCallback(() => {
    stopListening();
    const answer = (answerRef.current + interim).trim();
    const finalHistory = answer ? [...historyRef.current, { role: "candidate" as const, content: answer }] : historyRef.current;
    if (finalHistory.filter((t) => t.role === "candidate").length === 0) { setPhase("preflight"); return; }
    finish(finalHistory);
  }, [interim, stopListening, finish]);

  // cleanup
  useEffect(() => () => {
    recognitionRef.current?.stop();
    audioRef.current?.pause();
    stopFaceSampling();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    avatarSessionRef.current?.stop().catch(() => {});
  }, [stopFaceSampling]);

  const meta = PERSONAS[persona];
  const initials = meta.label.split(" ").map((w) => w[0]).join("").slice(0, 2);
  const inCall = phase === "speaking" || phase === "listening" || phase === "thinking";

  return (
    <div className="relative flex min-h-screen flex-col bg-mesh">
      {/* Top bar */}
      <div className="flex items-center gap-4 border-b border-border bg-card/70 px-4 py-3 backdrop-blur-xl sm:px-6">
        <Link href={`/dashboard/jobs/${jobId}`} onClick={() => { recognitionRef.current?.stop(); audioRef.current?.pause(); streamRef.current?.getTracks().forEach((t) => t.stop()); avatarSessionRef.current?.stop().catch(() => {}); }}
          className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            AI Avatar Room
            {jobTitle && <span className="font-normal text-muted-foreground"> · {jobTitle}{jobCompany ? ` @ ${jobCompany}` : ""}</span>}
          </p>
        </div>
        <TokenBalance value={balance ?? undefined} />
      </div>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6">

        {/* Preflight */}
        {phase === "preflight" && (
          <div className="w-full space-y-6 text-center">
            <div className={cn("mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-glow", meta.accent)}>
              <Video className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Avatar Interview Room</h1>
              <p className="mt-2 text-muted-foreground">
                A face-to-face video simulation. Pick your interviewer, turn on your camera, and practice under real conditions.
              </p>
            </div>

            {!supported ? (
              <div className="rounded-xl border border-desyn-warning/30 bg-desyn-warning/15 p-4 text-sm text-desyn-warning">
                Avatar interviews need Chrome or Edge for speech recognition.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {PERSONA_KEYS.map((k) => {
                    const p = PERSONAS[k];
                    const active = persona === k;
                    return (
                      <button key={k} onClick={() => setPersona(k)}
                        className={cn("rounded-xl border p-3 text-center transition-colors", active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40")}>
                        <div className={cn("mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br text-xs font-bold text-white", p.accent)}>
                          {p.label.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                        </div>
                        <p className="mt-2 text-xs font-semibold leading-tight">{p.label}</p>
                      </button>
                    );
                  })}
                </div>

                {/* Camera setup */}
                <div className="rounded-xl border border-border bg-card p-4">
                  {cameraReady ? (
                    <div className="flex items-center gap-3">
                      <div className="relative h-16 w-24 overflow-hidden rounded-lg bg-black">
                        <video ref={selfVideoRef} muted playsInline className="h-full w-full object-cover" />
                      </div>
                      <div className="text-left">
                        <p className="flex items-center gap-1.5 text-sm font-medium text-desyn-success"><CheckCircle2 className="h-4 w-4" /> Camera ready</p>
                        <p className="text-xs text-muted-foreground">
                          {faceSupported ? "Eye-contact analysis on" : "Body-language analysis unavailable in this browser"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <button onClick={enableCamera} className="flex w-full items-center justify-center gap-2 text-sm font-medium text-primary">
                      <Camera className="h-4 w-4" /> Enable camera & mic for the full experience
                    </button>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">Up to 5 questions plus follow-ups · {TOKEN_PER_TURN} tokens each</p>
                <Button size="lg" className="w-full gap-2" onClick={start}>
                  <Play className="h-5 w-5" /> Enter the room
                </Button>
                {!cameraReady && <p className="text-xs text-muted-foreground">You can start without a camera — you&apos;ll just skip body-language scoring.</p>}
              </>
            )}
          </div>
        )}

        {/* Blocked */}
        {phase === "blocked" && (
          <div className="w-full max-w-md space-y-5 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10"><Lock className="h-7 w-7 text-primary" /></div>
            <h2 className="text-xl font-bold">Unlock the Avatar Room</h2>
            <p className="text-muted-foreground">{errorMsg}</p>
            <Link href="/dashboard/billing" className="inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-6 py-3 text-sm font-semibold text-white shadow-glow">
              <Coins className="h-4 w-4" /> See plans & tokens
            </Link>
          </div>
        )}

        {/* In call */}
        {inCall && (
          <div className="w-full space-y-5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {isFollowup
                  ? <span className="font-medium text-primary">Follow-up question</span>
                  : `Question ${mainNum} of 5`}
                {" · "}{meta.title}
              </span>
              {trial && <span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">Free trial</span>}
            </div>

            {/* video stage */}
            <div className="grid gap-4 sm:grid-cols-2">
              {/* avatar tile */}
              <div className="relative aspect-video overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
                {/* HeyGen live avatar video (shown when streaming is active) */}
                <video
                  ref={avatarVideoRef}
                  autoPlay
                  playsInline
                  className={cn("absolute inset-0 h-full w-full object-cover", !avatarActive && "hidden")}
                />
                {/* Simulated persona (fallback when no streaming avatar) */}
                {!avatarActive && (
                  <>
                    <div className={cn("absolute inset-0 bg-gradient-to-br opacity-90", meta.accent)} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                      <div className={cn("flex h-20 w-20 items-center justify-center rounded-full bg-white/20 text-2xl font-bold backdrop-blur", phase === "speaking" && "animate-pulse-ring")}>
                        {initials}
                      </div>
                      <p className="mt-3 text-sm font-semibold">{meta.label}</p>
                      {phase === "speaking" ? <AudioBars bars={9} tone="muted" className="mt-2 h-4 opacity-90" />
                        : <p className="mt-1 text-xs opacity-80">{phase === "thinking" ? "…" : "listening"}</p>}
                    </div>
                  </>
                )}
                <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/30 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
                  <Volume2 className="h-3 w-3" /> Interviewer
                </span>
                {phase === "speaking" && !avatarActive && (
                  <button onClick={replay} className="absolute bottom-3 right-3 rounded-full bg-black/30 px-2 py-0.5 text-[10px] text-white backdrop-blur">replay</button>
                )}
              </div>

              {/* self view */}
              <div className="relative aspect-video overflow-hidden rounded-2xl border border-border bg-black shadow-soft">
                {cameraReady ? (
                  <video ref={selfVideoRef} muted playsInline className="h-full w-full -scale-x-100 object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground"><VideoOff className="h-8 w-8" /></div>
                )}
                <span className="absolute left-3 top-3 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">You</span>
                {phase === "listening" && (
                  <span className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-destructive/80 px-2 py-0.5 text-[10px] font-medium text-white">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> REC
                  </span>
                )}
              </div>
            </div>

            {/* question */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="text-lg font-medium leading-snug">{question}</p>
            </div>

            {/* answer controls */}
            {phase === "thinking" ? (
              <div className="flex items-center justify-center gap-3 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin text-primary" /> Thinking…
              </div>
            ) : phase === "listening" ? (
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="min-h-12 text-sm leading-relaxed">
                  {(answerRef.current || interim)
                    ? <span>{answerRef.current}<span className="text-muted-foreground/60 italic">{interim}</span></span>
                    : <span className="text-muted-foreground/40 italic">Answer out loud — your words appear here…</span>}
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <Button variant="outline" size="sm" onClick={endEarly} className="text-muted-foreground">End & analyze</Button>
                  <Button onClick={submitAnswer} className="gap-1.5">Done answering <ChevronRight className="h-4 w-4" /></Button>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Analyzing */}
        {phase === "analyzing" && (
          <div className="flex flex-col items-center gap-4 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analyzing your answers, delivery, and presence…</p>
          </div>
        )}

        {/* Results */}
        {phase === "results" && analysis && (
          <AvatarResults analysis={analysis} recordedUrl={recordedUrl} onRestart={() => {
            setHistory([]); setAnalysis(null); setQuestion(""); turnRef.current = 0; mainRef.current = 0; lastFollowupRef.current = false; setMainNum(1); setIsFollowup(false); durationRef.current = 0;
            answerRef.current = ""; setInterim(""); faceStatsRef.current = { total: 0, presence: 0, eye: 0, steady: 0, lastX: -1 };
            setRecordedUrl(null); setCameraReady(false); setPhase("preflight");
          }} />
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

// ── Results ────────────────────────────────────────────────────────────────────
function AvatarResults({ analysis, recordedUrl, onRestart }: { analysis: AvatarAnalysis; recordedUrl: string | null; onRestart: () => void }) {
  const bl = analysis.body_language;
  const tone = analysis.overall >= 4 ? "success" : analysis.overall >= 3 ? "warning" : "brand";
  const dims = [
    { label: "Communication", value: analysis.communication },
    { label: "Technical", value: analysis.technical },
    { label: "Behavioral", value: analysis.behavioral },
    { label: "Confidence", value: analysis.confidence },
  ];

  return (
    <div className="w-full space-y-5">
      <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-soft">
        <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Avatar interview complete</p>
        <div className="mt-5 flex justify-center">
          <StatRing value={(analysis.overall / 5) * 100} label={`${analysis.overall}`} sublabel="of 5" tone={tone} size={150} />
        </div>
        {analysis.summary && <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground">{analysis.summary}</p>}
      </div>

      {/* presence / body language */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric icon={Eye} label="Eye contact" value={bl.available && bl.eye_contact !== null ? `${bl.eye_contact}%` : "—"} sub={bl.available ? "centered gaze" : "no camera data"} />
        <Metric icon={Video} label="On-camera" value={bl.available && bl.presence !== null ? `${bl.presence}%` : "—"} sub="in frame" />
        <Metric icon={Gauge} label="Speaking pace" value={`${analysis.speaking_pace.wpm}`} sub={`wpm · ${analysis.speaking_pace.label}`} />
        <Metric icon={Sparkles} label="Filler words" value={`${analysis.filler_words.count}`} sub={`${analysis.filler_words.per_min}/min`} />
      </div>

      {/* recording */}
      {recordedUrl && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Video className="h-4 w-4 text-primary" /> Your recording</p>
          <video src={recordedUrl} controls className="w-full rounded-lg bg-black" />
          <a href={recordedUrl} download="avatar-interview.webm" className="mt-2 inline-block text-xs text-primary hover:underline">Download replay</a>
        </div>
      )}

      {/* dimension bars */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
          {dims.map(({ label, value }) => {
            const v = Math.max(0, Math.min(100, Math.round(value)));
            const t = v >= 75 ? "bg-desyn-success" : v >= 50 ? "bg-amber-500" : "bg-destructive";
            return (
              <div key={label}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-semibold tabular-nums">{v}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className={cn("h-full rounded-full transition-all duration-700", t)} style={{ width: `${v}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* strengths + improvements */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-desyn-success/30 bg-desyn-success/5 p-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-desyn-success"><CheckCircle2 className="h-3.5 w-3.5" /> Strengths</p>
          <ul className="space-y-1.5">{analysis.strengths.map((s, i) => <li key={i} className="flex items-start gap-2 text-sm"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-desyn-success" />{s}</li>)}</ul>
        </div>
        <div className="rounded-xl border border-desyn-warning/30 bg-desyn-warning/15 p-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-desyn-warning"><AlertCircle className="h-3.5 w-3.5" /> Improve</p>
          <ul className="space-y-1.5">{analysis.improvements.map((s, i) => <li key={i} className="flex items-start gap-2 text-sm"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />{s}</li>)}</ul>
        </div>
      </div>

      <div className="flex justify-center">
        <Button variant="outline" onClick={onRestart}><RotateCcw className="mr-1.5 h-4 w-4" /> Practice again</Button>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Icon className="h-3.5 w-3.5" /> {label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}
