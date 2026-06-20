"use client";

import { useEffect, useState } from "react";
import { Loader2, Clock } from "lucide-react";

// Resume parsing is a server-side step: text extraction + one LLM call
// (~5s on gpt-4o). It does NOT depend on the user's connection, so the old
// "varies based on your internet speed" / 2-minute bandwidth estimate was
// misleading. This is a light progress affordance only — the parent polls the
// real parse_status and swaps this out the moment parsing actually completes.
const EST_SECONDS = 12;

export function ResumeParsingStatus() {
  const [progress, setProgress] = useState(12);
  const [timeLeft, setTimeLeft] = useState(EST_SECONDS);

  // Climb toward 95% over roughly the estimate, then hold until the parent
  // removes us on completion (never show 100% until it's actually done).
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => (p >= 95 ? p : Math.min(p + (Math.random() * 10 + 4), 95)));
    }, 600);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((t) => (t <= 2 ? 2 : t - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin text-primary" />
          <span className="text-xs font-medium text-foreground">Analyzing resume</span>
          <span className="text-[10px] text-muted-foreground">{Math.round(progress)}%</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock className="h-2.5 w-2.5" />
          <span>~{timeLeft}s</span>
        </div>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-gradient-to-r from-primary to-green-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-[9px] text-muted-foreground italic">Extracting and structuring your resume…</p>
    </div>
  );
}
