"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, X, Loader2, ChevronDown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message { role: "user" | "assistant"; content: string }

const SUGGESTED = [
  "Who are the top candidates I should call today?",
  "Which source is generating the best quality applicants?",
  "How many interviews do we have this week?",
  "Which roles have been open the longest?",
];

export function CopilotFloat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  // Cmd+K / Ctrl+K global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const send = async (text?: string) => {
    const q = (text ?? input).trim();
    if (!q || thinking) return;
    setInput("");
    const next: Message[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setThinking(true);
    try {
      const res = await fetch("/api/enterprise/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, history: messages }),
      });
      const json = await res.json();
      setMessages([...next, { role: "assistant", content: json.reply ?? "I couldn't find an answer." }]);
    } catch {
      setMessages([...next, { role: "assistant", content: "Something went wrong. Please try again." }]);
    } finally {
      setThinking(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          title="Recruiter Copilot (⌘K)"
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-brand shadow-glow transition-transform hover:scale-105 active:scale-95">
          <Sparkles className="h-6 w-6 text-white" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 flex w-[360px] flex-col rounded-2xl border border-border bg-card shadow-2xl"
          style={{ maxHeight: "min(520px, calc(100vh - 80px))" }}>
          {/* Header */}
          <div className="flex items-center gap-2.5 rounded-t-2xl border-b border-border bg-gradient-brand px-4 py-3.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">Recruiter Copilot</p>
              <p className="text-[10px] text-white/70">⌘K to toggle · Ask anything about your pipeline</p>
            </div>
            <button onClick={() => setOpen(false)} className="rounded-lg p-1 text-white/70 hover:bg-white/10 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-0">
            {messages.length === 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] text-muted-foreground px-1 pt-1">Try asking:</p>
                {SUGGESTED.map((s) => (
                  <button key={s} onClick={() => send(s)}
                    className="w-full rounded-xl border border-border px-3 py-2 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={cn("flex gap-1.5", m.role === "user" ? "justify-end" : "justify-start")}>
                {m.role === "assistant" && (
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-brand">
                    <Bot className="h-2.5 w-2.5 text-white" />
                  </div>
                )}
                <div className={cn(
                  "max-w-[88%] rounded-2xl px-3 py-2 text-xs whitespace-pre-wrap leading-relaxed",
                  m.role === "user"
                    ? "rounded-br-sm bg-primary text-primary-foreground"
                    : "rounded-bl-sm bg-muted text-foreground"
                )}>
                  {m.content}
                </div>
              </div>
            ))}

            {thinking && (
              <div className="flex items-center gap-1.5">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-brand">
                  <Bot className="h-2.5 w-2.5 text-white" />
                </div>
                <div className="flex items-center gap-1.5 rounded-2xl bg-muted px-3 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Thinking…
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-border p-2.5">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Ask about your pipeline…"
                className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button onClick={() => send()} disabled={!input.trim() || thinking}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-brand text-white disabled:opacity-40">
                <ChevronDown className="h-3.5 w-3.5 -rotate-90" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
