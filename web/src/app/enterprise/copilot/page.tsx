"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, Send, RefreshCw, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message { role: "user" | "assistant"; content: string }

const EXAMPLES = [
  { label: "Top candidates", prompt: "Who are the top 5 candidates I should prioritize across all active jobs?" },
  { label: "Pipeline health", prompt: "How is our overall hiring pipeline looking? Any bottlenecks?" },
  { label: "Source quality", prompt: "Which candidate source is producing the best quality applicants?" },
  { label: "Action needed", prompt: "What candidates have been waiting the longest without a decision?" },
  { label: "Interview forecast", prompt: "How many interviews do we have this week and next week?" },
  { label: "Conversion rates", prompt: "What's our conversion rate from applied to hired?" },
];

export default function CopilotPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

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
    <main className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-brand shadow-glow">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-semibold">Recruiter Copilot</h1>
            <p className="text-xs text-muted-foreground">Ask anything about your candidates, pipeline, or hiring metrics</p>
          </div>
          {messages.length > 0 && (
            <button onClick={() => setMessages([])}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
              <RefreshCw className="h-3 w-3" /> New conversation
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-3xl space-y-5">
          {messages.length === 0 && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 text-center">
                <Bot className="mx-auto mb-3 h-10 w-10 text-primary" />
                <h2 className="font-semibold">What would you like to know?</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  I have real-time access to your entire candidate pipeline, job postings, interview data, and hiring metrics.
                </p>
              </div>

              <div>
                <p className="mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Try asking</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {EXAMPLES.map((ex) => (
                    <button key={ex.label} onClick={() => send(ex.prompt)}
                      className="rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-primary/30 hover:bg-primary/5">
                      <p className="text-xs font-semibold text-primary">{ex.label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{ex.prompt}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={cn("flex gap-3", m.role === "user" ? "justify-end" : "justify-start")}>
              {m.role === "assistant" && (
                <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-brand">
                  <Bot className="h-3.5 w-3.5 text-white" />
                </div>
              )}
              <div className={cn(
                "max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed",
                m.role === "user"
                  ? "rounded-br-sm bg-primary text-primary-foreground"
                  : "rounded-bl-sm bg-card border border-border"
              )}>
                {m.content}
              </div>
            </div>
          ))}

          {thinking && (
            <div className="flex items-start gap-3">
              <div className="mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-gradient-brand">
                <Bot className="h-3.5 w-3.5 text-white" />
              </div>
              <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching your pipeline…
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border bg-card/80 px-4 py-4 backdrop-blur">
        <div className="mx-auto max-w-3xl">
          <div className="flex gap-3 rounded-2xl border border-border bg-background p-2 focus-within:ring-2 focus-within:ring-primary">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask about your pipeline… (Enter to send, Shift+Enter for new line)"
              rows={1}
              className="flex-1 resize-none bg-transparent px-2 py-1 text-sm focus:outline-none"
              style={{ minHeight: "36px", maxHeight: "120px" }}
            />
            <button onClick={() => send()} disabled={!input.trim() || thinking}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-brand text-white disabled:opacity-40 transition-opacity">
              {thinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            Copilot has access to your live pipeline data · up to 100 candidates + 50 talent pool entries
          </p>
        </div>
      </div>
    </main>
  );
}
