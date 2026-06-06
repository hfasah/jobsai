"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, Mic, X, Send, Bot, Headphones, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { botAnswer, botGreeting, SUGGESTED } from "@/lib/support-bot";

type Mode = "chat" | "voice";
type Msg = { role: "bot" | "user"; text: string };

// Minimal Web Speech typings (Chrome/Edge). Avoids `any`.
interface SpeechRecognitionResultLike { 0: { transcript: string }; isFinal: boolean }
interface SpeechRecognitionEventLike { results: ArrayLike<SpeechRecognitionResultLike> }
interface SpeechRecognitionLike {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null; onerror: (() => void) | null;
  start: () => void; stop: () => void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function SupportWidget() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("chat");
  const [messages, setMessages] = useState<Msg[]>([{ role: "bot", text: botGreeting() }]);
  const [input, setInput] = useState("");

  // voice state
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceLine, setVoiceLine] = useState<string>("Tap the mic and ask a question.");
  const [voiceSupported, setVoiceSupported] = useState(() => getRecognitionCtor() !== null);
  const recogRef = useRef<SpeechRecognitionLike | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, mode]);

  const pushAnswer = useCallback((question: string) => {
    const reply = botAnswer(question);
    setMessages((m) => [...m, { role: "user", text: question }, { role: "bot", text: reply }]);
    return reply;
  }, []);

  const sendChat = (text?: string) => {
    const q = (text ?? input).trim();
    if (!q) return;
    setInput("");
    pushAnswer(q);
  };

  // ── Voice ────────────────────────────────────────────────────────────────
  const speak = useCallback((text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.02;
    u.onend = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(u);
  }, []);

  const startListening = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) { setVoiceSupported(false); return; }
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    setSpeaking(false);
    const r = new Ctor();
    r.lang = "en-US";
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => {
      const last = e.results[e.results.length - 1];
      const text = last[0].transcript;
      setVoiceLine(text);
      if (last.isFinal) {
        const reply = pushAnswer(text);
        setVoiceLine(text);
        speak(reply);
      }
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recogRef.current = r;
    setListening(true);
    r.start();
  }, [pushAnswer, speak]);

  const stopVoice = useCallback(() => {
    recogRef.current?.stop();
    setListening(false);
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);

  return (
    <div className="dark fixed bottom-5 right-5 z-[60] flex flex-col items-end">
      {open && (
        <div className="mb-3 flex h-[30rem] w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-card text-foreground shadow-glow-purple">
          {/* header */}
          <div className="flex items-center justify-between bg-gradient-brand px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              <div className="leading-tight">
                <p className="text-sm font-semibold">JobsAI Assistant</p>
                <p className="text-[11px] opacity-80">Typically replies instantly</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close support" className="rounded-md p-1 hover:bg-white/15">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* mode tabs */}
          <div className="flex border-b border-border">
            {([["chat", MessageCircle, "Chat"], ["voice", Headphones, "Voice"]] as const).map(
              ([m, Icon, label]) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors",
                    mode === m ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" /> {label}
                </button>
              )
            )}
          </div>

          {/* chat mode */}
          {mode === "chat" && (
            <>
              <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
                {messages.map((msg, i) => (
                  <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                        msg.role === "user"
                          ? "rounded-br-sm bg-primary text-primary-foreground"
                          : "rounded-bl-sm bg-muted text-foreground"
                      )}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
                {messages.length <= 1 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {SUGGESTED.map((s) => (
                      <button
                        key={s}
                        onClick={() => sendChat(s)}
                        className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <form
                onSubmit={(e) => { e.preventDefault(); sendChat(); }}
                className="flex items-center gap-2 border-t border-border p-2"
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about auto-apply, pricing…"
                  className="h-10 flex-1 rounded-xl bg-background/60 px-3 text-sm outline-none placeholder:text-muted-foreground"
                />
                <button type="submit" className="btn-cta flex h-10 w-10 items-center justify-center rounded-xl" aria-label="Send">
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </>
          )}

          {/* voice mode */}
          {mode === "voice" && (
            <div className="flex flex-1 flex-col items-center justify-center gap-5 p-5 text-center">
              {voiceSupported ? (
                <>
                  <button
                    onClick={listening ? stopVoice : startListening}
                    className={cn(
                      "relative flex h-24 w-24 items-center justify-center rounded-full text-white transition-transform",
                      listening ? "bg-destructive animate-pulse-ring" : "bg-gradient-brand shadow-glow-purple hover:scale-105"
                    )}
                    aria-label={listening ? "Stop" : "Tap to talk"}
                  >
                    {listening ? <Square className="h-7 w-7" /> : <Mic className="h-8 w-8" />}
                  </button>
                  <p className="min-h-[2.5rem] px-2 text-sm text-muted-foreground">
                    {speaking ? "Speaking…" : listening ? "Listening…" : voiceLine}
                  </p>
                  <p className="text-[11px] text-muted-foreground/70">
                    Voice support runs in your browser, no recording leaves this page.
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Voice support needs Chrome or Edge. Please use the Chat tab instead.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* launcher */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="btn-cta flex h-14 w-14 items-center justify-center rounded-full shadow-glow-purple"
        aria-label={open ? "Close support" : "Open support"}
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </div>
  );
}
