"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Send, Mail, CalendarCheck, CheckCircle2, Building2, TrendingUp,
  ChevronLeft, ChevronRight, Mic, Sparkles,
} from "lucide-react";
import { StatRing } from "@/components/ui/stat-ring";
import { AudioBars } from "@/components/ui/audio-bars";
import { cn } from "@/lib/utils";

type Slide = {
  key: string;
  tag: string;
  title: string;
  body: string;
  visual: React.ReactNode;
};

const APPLIED = [
  { role: "Senior Product Manager", co: "Stripe", ats: "Greenhouse" },
  { role: "Staff Engineer", co: "Linear", ats: "Ashby" },
  { role: "Data Scientist", co: "Ramp", ats: "Lever" },
  { role: "Growth Lead", co: "Notion", ats: "Workday" },
];

function AutoApplyVisual() {
  return (
    <div className="w-full">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Send className="h-4 w-4 text-primary" /> Applying for you
        </div>
        <span className="rounded-full bg-desyn-success/15 px-2.5 py-1 text-xs font-bold text-desyn-success">
          147 this week
        </span>
      </div>
      <div className="space-y-2">
        {APPLIED.map((j, i) => (
          <div
            key={j.role}
            className="flex items-center gap-3 rounded-xl border border-border bg-background/50 px-3 py-2.5"
            style={{ animation: `bar 2s ease-in-out ${i * 0.25}s infinite alternate`, opacity: 0.96 }}
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 text-desyn-success" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{j.role}</p>
              <p className="text-xs text-muted-foreground">{j.co}</p>
            </div>
            <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{j.ats}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function OutreachVisual() {
  const notes = [
    { to: "Recruiter · Stripe", txt: "Hi Dana — I'd love to be considered for the Senior PM role…", t: "now" },
    { to: "Hiring Manager · Ramp", txt: "Sharing a tailored resume for the Data Scientist opening.", t: "2m" },
    { to: "Recruiter · Notion", txt: "Following up on the Growth Lead position — keen to chat.", t: "1h" },
  ];
  return (
    <div className="w-full space-y-2.5">
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <Mail className="h-4 w-4 text-desyn-cyan" /> Reaching recruiters directly
      </div>
      {notes.map((n) => (
        <div key={n.to} className="rounded-xl border border-border bg-background/50 p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground">{n.to}</p>
            <span className="text-[10px] text-muted-foreground">{n.t}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{n.txt}</p>
        </div>
      ))}
    </div>
  );
}

function InterviewsVisual() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const slots: Record<string, string> = { Tue: "Stripe · 2pm", Thu: "Ramp · 11am", Fri: "Notion · 4pm" };
  return (
    <div className="w-full">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
        <CalendarCheck className="h-4 w-4 text-desyn-success" /> Interviews booked for you
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {days.map((d) => (
          <div key={d} className="flex flex-col items-center gap-1.5">
            <span className="text-[10px] font-medium text-muted-foreground">{d}</span>
            <div
              className={cn(
                "flex h-20 w-full flex-col items-center justify-center rounded-lg border p-1 text-center",
                slots[d] ? "border-transparent bg-gradient-brand text-white shadow-glow" : "border-border bg-background/40"
              )}
            >
              {slots[d] && <span className="text-[10px] font-semibold leading-tight">{slots[d]}</span>}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Building2 className="h-3.5 w-3.5" /> 3 interviews this week — guaranteed within 90 days.
      </p>
    </div>
  );
}

function PrepVisual() {
  return (
    <div className="flex w-full items-center gap-4">
      <StatRing value={92} size={92} strokeWidth={9} sublabel="ready" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center gap-2 rounded-xl bg-gradient-brand p-2.5 text-white">
          <Mic className="h-4 w-4" />
          <p className="truncate text-xs font-semibold">&ldquo;Tell me about a time you led under pressure…&rdquo;</p>
          <AudioBars bars={6} tone="muted" className="ml-auto h-5 opacity-90" />
        </div>
        <div className="flex items-center justify-between rounded-xl border border-border bg-background/50 px-3 py-2 text-xs">
          <span className="flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5 text-desyn-success" /> Confidence</span>
          <span className="font-semibold text-desyn-success">Strong</span>
        </div>
      </div>
    </div>
  );
}

const SLIDES: Slide[] = [
  { key: "apply", tag: "Auto-apply", title: "We apply, all day", body: "Tailored resume and cover letter submitted to every matching role across Lever, Greenhouse, Ashby, and Workday.", visual: <AutoApplyVisual /> },
  { key: "outreach", tag: "Outreach", title: "Straight to recruiters", body: "We reach the people who actually book interviews — not just the application portal.", visual: <OutreachVisual /> },
  { key: "interviews", tag: "Results", title: "Interviews land for you", body: "Watch your week fill with interviews — backed by our 90-day guarantee.", visual: <InterviewsVisual /> },
  { key: "prep", tag: "Bonus", title: "Then we get you ready", body: "Practice the exact interview with written, voice, and avatar rounds and scored feedback.", visual: <PrepVisual /> },
];

export function ShowcaseSlides() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = SLIDES.length;

  const go = useCallback((d: number) => setI((c) => (c + d + n) % n), [n]);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setI((c) => (c + 1) % n), 4500);
    return () => clearInterval(id);
  }, [paused, n]);

  const s = SLIDES[i];

  return (
    <div
      className="mx-auto max-w-4xl"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="grid items-center gap-8 rounded-3xl border border-white/10 bg-card/60 p-6 backdrop-blur sm:p-10 md:grid-cols-2">
        {/* copy */}
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--cta)]/40 bg-[var(--cta)]/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[var(--cta)]">
            <Sparkles className="h-3.5 w-3.5" /> {s.tag}
          </span>
          <h3 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">{s.title}</h3>
          <p className="mt-3 text-muted-foreground">{s.body}</p>

          <div className="mt-6 flex items-center gap-3">
            <button onClick={() => go(-1)} aria-label="Previous" className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex gap-1.5">
              {SLIDES.map((sl, idx) => (
                <button
                  key={sl.key}
                  onClick={() => setI(idx)}
                  aria-label={`Go to ${sl.title}`}
                  className={cn(
                    "h-2 rounded-full transition-all",
                    idx === i ? "w-6 bg-gradient-brand" : "w-2 bg-border hover:bg-muted-foreground/40"
                  )}
                />
              ))}
            </div>
            <button onClick={() => go(1)} aria-label="Next" className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* visual */}
        <div className="flex min-h-[15rem] items-center rounded-2xl border border-white/10 bg-background/40 p-5">
          {s.visual}
        </div>
      </div>
    </div>
  );
}
