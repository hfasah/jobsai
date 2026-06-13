"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle, X, Send, Bot, Loader2, Paperclip, ImageIcon, ChevronRight, ExternalLink } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { cn } from "@/lib/utils";

type Msg = { role: "bot" | "user"; text: string; imageDataUrl?: string };

const SUGGESTED = [
  "How does auto-apply work?",
  "What's the interview guarantee?",
  "How much does it cost?",
  "Is there a free plan?",
  "How do I cancel?",
  "My application failed",
];

// ── Minimal markdown renderer ─────────────────────────────────────────────────
// Handles: **bold**, [text](url), numbered lists, bullet lists, plain links
function MarkdownText({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: React.ReactNode[] = [];
  let listType: "ol" | "ul" | null = null;

  const flushList = () => {
    if (!listItems.length) return;
    const Tag = listType === "ol" ? "ol" : "ul";
    elements.push(
      <Tag key={`list-${elements.length}`} className={cn("mt-1.5 space-y-0.5 pl-4 text-sm", listType === "ol" ? "list-decimal" : "list-disc")}>
        {listItems}
      </Tag>
    );
    listItems = [];
    listType = null;
  };

  const renderInline = (s: string): React.ReactNode[] => {
    // Process **bold** and [text](url) together
    const parts: React.ReactNode[] = [];
    const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\((https?:\/\/[^\)]+)\)|(https?:\/\/\S+)/g;
    let last = 0, m: RegExpExecArray | null;
    while ((m = re.exec(s)) !== null) {
      if (m.index > last) parts.push(s.slice(last, m.index));
      if (m[1]) parts.push(<strong key={m.index}>{m[1]}</strong>);
      else if (m[2] && m[3]) parts.push(<a key={m.index} href={m[3]} className="text-primary underline underline-offset-2 hover:opacity-80" target="_blank" rel="noopener noreferrer">{m[2]}</a>);
      else if (m[4]) parts.push(<a key={m.index} href={m[4]} className="text-primary underline underline-offset-2 hover:opacity-80" target="_blank" rel="noopener noreferrer">{m[4]}</a>);
      last = m.index + m[0].length;
    }
    if (last < s.length) parts.push(s.slice(last));
    return parts;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const olMatch = /^(\d+)\.\s+(.+)/.exec(line);
    const ulMatch = /^[-•*]\s+(.+)/.exec(line);

    if (olMatch) {
      if (listType !== "ol") { flushList(); listType = "ol"; }
      listItems.push(<li key={i}>{renderInline(olMatch[2])}</li>);
    } else if (ulMatch) {
      if (listType !== "ul") { flushList(); listType = "ul"; }
      listItems.push(<li key={i}>{renderInline(ulMatch[1])}</li>);
    } else {
      flushList();
      if (line.trim()) {
        elements.push(<p key={i} className="text-sm leading-relaxed">{renderInline(line)}</p>);
      } else if (elements.length > 0) {
        elements.push(<div key={`gap-${i}`} className="h-1.5" />);
      }
    }
  }
  flushList();

  return <div className="space-y-1">{elements}</div>;
}

export function SupportWidget() {
  const pathname = usePathname();
  const { user, isSignedIn } = useUser();
  const firstName = user?.firstName ?? null;

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const conversationRef = useRef<Msg[]>([]);
  conversationRef.current = messages;

  // Build greeting once user data is available
  const greeting = firstName
    ? `Hi ${firstName}! I'm the JobsAI assistant. What can I help you with?`
    : "Hi! I'm the JobsAI assistant. Ask me about auto-apply, pricing, the 90-day interview guarantee, or getting started.";

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, thinking]);

  // ── AI call ───────────────────────────────────────────────────────────────────
  const askAI = useCallback(async (userText: string, imageDataUrl?: string): Promise<string> => {
    const history = conversationRef.current.map((m) => ({
      role: m.role === "bot" ? "assistant" : "user",
      content: m.text,
      ...(m.imageDataUrl ? { imageDataUrl: m.imageDataUrl } : {}),
    }));
    history.push({ role: "user", content: userText, ...(imageDataUrl ? { imageDataUrl } : {}) });

    const res = await fetch("/api/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history }),
    });
    const json = await res.json().catch(() => ({}));
    return json.reply ?? "I couldn't reach the server. Please email support@jobsai.work.";
  }, []);

  // ── Send message ──────────────────────────────────────────────────────────────
  const sendChat = useCallback(async (text?: string, img?: string | null) => {
    const q = (text ?? input).trim();
    const image = img ?? pendingImage ?? undefined;
    if (!q && !image) return;
    setInput("");
    setPendingImage(null);
    const userMsg: Msg = { role: "user", text: q || "(screenshot)", ...(image ? { imageDataUrl: image } : {}) };
    setMessages((m) => [...m, userMsg]);
    setThinking(true);
    try {
      const reply = await askAI(q || "(screenshot shared)", image ?? undefined);
      setMessages((m) => [...m, { role: "bot", text: reply }]);
    } catch {
      setMessages((m) => [...m, { role: "bot", text: "Something went wrong. Please email [support@jobsai.work](mailto:support@jobsai.work)." }]);
    } finally {
      setThinking(false);
    }
  }, [input, pendingImage, askAI]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPendingImage(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const isEmpty = messages.length === 0;

  // Consumer (job-seeker) support chat — hide on the enterprise portal.
  if (pathname.startsWith("/enterprise") || pathname.startsWith("/e/")) return null;

  return (
    <div className="dark fixed bottom-5 right-5 z-[60] flex flex-col items-end">
      {open && (
        <div className="mb-3 flex w-[23rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-card text-foreground shadow-glow-purple"
          style={{ height: "34rem" }}>

          {/* ── header ── */}
          <div className="flex items-center justify-between bg-gradient-brand px-4 py-3 text-white">
            <div className="flex items-center gap-2.5">
              <Bot className="h-5 w-5" />
              <div className="leading-tight">
                <p className="text-sm font-semibold">JobsAI Support</p>
                <p className="text-[11px] opacity-80">
                  {isSignedIn ? "Signed in · AI-powered" : "AI-powered · replies instantly"}
                </p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close" className="rounded-md p-1 hover:bg-white/15">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* ── home screen (no messages yet) ── */}
          {isEmpty ? (
            <div className="flex flex-1 flex-col overflow-y-auto">
              {/* greeting */}
              <div className="px-4 pb-2 pt-5">
                <p className="text-xl font-bold leading-snug">{greeting}</p>
              </div>

              {/* quick links (signed-in users) */}
              {isSignedIn && (
                <div className="px-4 pb-2">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quick links</p>
                  <div className="space-y-1">
                    {[
                      { label: "Job Search", href: "/dashboard/job-search" },
                      { label: "My Applications", href: "/dashboard/applications" },
                      { label: "Billing & Tokens", href: "/dashboard/billing" },
                    ].map(({ label, href }) => (
                      <a key={href} href={href}
                        className="flex items-center justify-between rounded-xl border border-border bg-background/40 px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted">
                        {label}
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* suggested questions */}
              <div className="px-4 pb-4">
                <p className="mb-2 mt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Common questions</p>
                <div className="space-y-1">
                  {SUGGESTED.map((s) => (
                    <button key={s} onClick={() => sendChat(s)}
                      className="flex w-full items-center justify-between rounded-xl border border-border bg-background/40 px-3 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted">
                      {s}
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </div>

              {/* contact fallback */}
              <div className="mt-auto border-t border-border px-4 py-3">
                <a href="/contact"
                  className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <ExternalLink className="h-3.5 w-3.5" /> Send us a detailed message via the contact page
                </a>
              </div>
            </div>
          ) : (
            /* ── conversation ── */
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
              {messages.map((msg, i) => (
                <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                  {msg.role === "bot" && (
                    <div className="mr-2 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-brand">
                      <Bot className="h-3.5 w-3.5 text-white" />
                    </div>
                  )}
                  <div className={cn(
                    "max-w-[82%] rounded-2xl px-3 py-2.5",
                    msg.role === "user" ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted"
                  )}>
                    {msg.imageDataUrl && (
                      <img src={msg.imageDataUrl} alt="screenshot" className="mb-1.5 max-h-32 rounded-lg object-contain" />
                    )}
                    {msg.role === "bot"
                      ? <MarkdownText text={msg.text} />
                      : <p className="text-sm">{msg.text}</p>
                    }
                  </div>
                </div>
              ))}
              {thinking && (
                <div className="flex justify-start">
                  <div className="mr-2 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-brand">
                    <Bot className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm bg-muted px-3 py-2.5 text-sm text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── image preview ── */}
          {pendingImage && (
            <div className="flex items-center gap-2 border-t border-border px-3 py-2">
              <ImageIcon className="h-4 w-4 shrink-0 text-primary" />
              <img src={pendingImage} alt="attachment" className="h-9 w-9 rounded object-cover" />
              <p className="flex-1 truncate text-xs text-muted-foreground">Screenshot ready</p>
              <button onClick={() => setPendingImage(null)} className="text-muted-foreground hover:text-destructive">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* ── input ── */}
          <form onSubmit={(e) => { e.preventDefault(); sendChat(); }}
            className="flex items-center gap-1.5 border-t border-border p-2">
            <input type="file" accept="image/*" ref={fileInputRef} onChange={onFileChange} className="hidden" />
            <button type="button" onClick={() => fileInputRef.current?.click()}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Attach screenshot" title="Attach screenshot">
              <Paperclip className="h-4 w-4" />
            </button>
            <input
              value={input} onChange={(e) => setInput(e.target.value)}
              placeholder={isEmpty ? "Ask a question…" : "Reply…"}
              className="h-10 flex-1 rounded-xl bg-background/60 px-3 text-sm outline-none placeholder:text-muted-foreground"
              disabled={thinking}
            />
            <button type="submit"
              disabled={thinking || (!input.trim() && !pendingImage)}
              className="btn-cta flex h-10 w-10 items-center justify-center rounded-xl disabled:opacity-40"
              aria-label="Send">
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}

      {/* ── launcher ── */}
      <button onClick={() => setOpen((o) => !o)}
        className="btn-cta flex h-14 w-14 items-center justify-center rounded-full shadow-glow-purple"
        aria-label={open ? "Close support" : "Open support"}>
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </div>
  );
}
