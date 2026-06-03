"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Headphones, Lock, Info, ShieldOff, Volume2, Apple, Monitor,
  Loader2, Download, CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Account = { balance: number; plan: string } | null;

// Anyone on a paid plan gets the desktop app; free users see the unlock CTA.
function isUnlocked(plan: string | undefined) {
  return plan != null && plan !== "free";
}

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
          <h1 className="text-2xl font-bold tracking-tight">Interview Buddy (Desktop)</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Get real-time assistance during job interviews with our desktop app, helping you answer
            questions confidently. Invisible to screen sharing &amp; listens to the interviewer on the go.
          </p>
        </div>
      </div>

      {/* Preview */}
      <div className="relative mt-8 aspect-video w-full overflow-hidden rounded-2xl border border-border bg-black">
        <div className="absolute inset-0 grid place-items-center">
          <span className="select-none text-3xl font-bold tracking-tight text-white/30 sm:text-5xl">
            Interview Buddy
          </span>
        </div>
        {/* faux audio indicator, bottom-right */}
        <div className="absolute bottom-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-desyn-accent text-desyn-accent-foreground shadow-glow">
          <Volume2 className="h-5 w-5" />
        </div>
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
