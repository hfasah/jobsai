"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Headphones, Lock, Info, ShieldOff, Volume2, Apple, Monitor,
  Loader2, Download, CheckCircle2, ArrowRight,
  MessageSquareText, Mic, Video,
} from "lucide-react";
import { AIImageSlot } from "@/components/ui/ai-image-slot";
import { cn } from "@/lib/utils";

// Image lives at /public/marketing/interview-buddy-live.webp. Flip to false to
// fall back to the placeholder.
const LIVE_ASSIST_IMAGE_READY = true;

type Account = { balance: number; plan: string } | null;

// Anyone on a paid plan gets the desktop app; free users see the unlock CTA.
function isUnlocked(plan: string | undefined) {
  return plan != null && plan !== "free";
}

// Mock-interview practice modes — the prep half of Interview Buddy.
const PRACTICE = [
  { label: "Written Coach", href: "/dashboard/interview?mode=written", icon: MessageSquareText, blurb: "Typed Q&A with instant STAR scoring" },
  { label: "Voice Interviewer", href: "/dashboard/interview?mode=voice", icon: Mic, blurb: "Spoken mock interview with feedback" },
  { label: "Avatar Room", href: "/dashboard/interview?mode=avatar", icon: Video, blurb: "Face-to-face video round" },
];

export default function InterviewBuddyPage() {
  const [account, setAccount] = useState<Account>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/tokens")
      .then((r) => r.json())
      .then((j) => { if (active && j.data) setAccount({ balance: j.data.balance, plan: j.data.plan }); })
      .catch(() => {})
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);

  const unlocked = isUnlocked(account?.plan);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-brand text-white shadow-glow">
          <Headphones className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Interview Buddy</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Your AI interview prep companion. Practice with personalized mock interviews built from your
            resume and the role, get instant feedback, then bring real-time assist to the real call.
          </p>
        </div>
      </div>

      {/* Practice first */}
      <section className="mt-8">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold">Practice first</h2>
          <Link href="/dashboard/interview" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            All prep modes <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {PRACTICE.map(({ label, href, icon: Icon, blurb }) => (
            <Link
              key={label}
              href={href}
              className="group flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-gradient-brand group-hover:text-white">
                <Icon className="h-5 w-5" />
              </span>
              <span className="mt-1 flex items-center gap-1 text-sm font-semibold">
                {label}
                <ArrowRight className="h-3.5 w-3.5 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
              </span>
              <span className="text-xs text-muted-foreground">{blurb}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Live assist heading */}
      <div className="mt-10 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">Live interview assist</h2>
        <span className="inline-flex items-center gap-1 rounded-full bg-desyn-accent/15 px-2 py-0.5 text-[11px] font-semibold text-desyn-accent">
          Added advantage · Desktop
        </span>
      </div>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        On top of prep, the desktop app listens to your interviewer and surfaces tailored answers in real
        time during the actual call — invisible to screen sharing.
      </p>

      {/* Preview image slot */}
      <div className="mt-6">
        <AIImageSlot
          path="/marketing/interview-buddy-live.webp"
          ready={LIVE_ASSIST_IMAGE_READY}
          alt="Interview Buddy live assist"
          prompt="The Interview Buddy desktop overlay during a video interview — a transcribed question with a suggested answer, dark UI, purple accents."
          className="shadow-glow-purple"
        />
      </div>

      {/* CTA */}
      <div className="mt-6 flex flex-col items-center">
        {!loaded ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking your plan…
          </div>
        ) : unlocked ? (
          <>
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-sm font-medium text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> Unlocked on your {account?.plan} plan
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <a
                href="/downloads/interview-buddy-mac.dmg"
                className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
              >
                <Apple className="h-4 w-4" /> Download for macOS
              </a>
              <a
                href="/downloads/interview-buddy-win.exe"
                className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
              >
                <Monitor className="h-4 w-4" /> Download for Windows
              </a>
            </div>
          </>
        ) : (
          <Link
            href="/dashboard/billing?feature=interview-buddy"
            className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-glow transition-colors hover:bg-emerald-600"
          >
            <Lock className="h-4 w-4" /> Unlock to access
          </Link>
        )}
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Download className="h-3.5 w-3.5" /> Available on Windows and macOS
        </p>
      </div>

      {/* Important note */}
      <div className="mt-8 flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">Important:</span> The desktop app only detects
          audio from the interviewer, not your microphone. If you&apos;re testing alone, the app won&apos;t
          pick up any audio — this doesn&apos;t mean it&apos;s broken! The app works perfectly during actual
          interviews when someone else is speaking.
        </p>
      </div>

      {/* How it works */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          { icon: ShieldOff, title: "Invisible to screen share", body: "Stays hidden from Zoom, Meet, Teams and other sharing tools." },
          { icon: Volume2, title: "Hears the interviewer", body: "Captures system audio and transcribes questions in real time." },
          { icon: Headphones, title: "Answers on the fly", body: "Surfaces tailored talking points the moment a question lands." },
        ].map((f) => {
          const Icon = f.icon;
          return (
            <div key={f.title} className="rounded-2xl border border-border bg-card p-4">
              <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-foreground")}>
                <Icon className="h-5 w-5" />
              </div>
              <p className="mt-3 text-sm font-semibold">{f.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </div>
          );
        })}
      </div>
    </main>
  );
}
