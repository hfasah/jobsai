"use client";

import { useEffect, useState } from "react";
import { Loader2, Clock, RotateCw } from "lucide-react";

// After this many seconds with no completion, surface a Retry — the background
// parse was likely killed (old import) and a re-kick recovers it.
const STUCK_AFTER_SECONDS = 75;

export function ProcessingPlaceholder({ jobId }: { jobId?: string }) {
  const [progress, setProgress] = useState(15);
  const [timeLeft, setTimeLeft] = useState(90);
  const [elapsed, setElapsed] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [retried, setRetried] = useState(false);

  // Wall-clock since mount, to detect a stuck parse.
  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const retry = async () => {
    if (!jobId) return;
    setRetrying(true);
    try {
      await fetch(`/api/jobs/${jobId}/reprocess`, { method: "POST" });
      setRetried(true);
      setElapsed(0); // restart the stuck timer; the page keeps polling
    } catch {
      // leave the button so they can try again
    } finally {
      setRetrying(false);
    }
  };

  const stuck = !!jobId && elapsed >= STUCK_AFTER_SECONDS;

  // Adjust the estimate to the visitor's connection speed (slower = longer).
  useEffect(() => {
    const conn = (navigator as Navigator & {
      connection?: { downlink?: number; saveData?: boolean };
    }).connection;
    const downlink = conn?.downlink ?? 5; // Mbps; 4g ~10 Mbps = 1.0x
    const speedMultiplier = Math.max(0.3, downlink / 10);
    const saveDataMultiplier = conn?.saveData ? 1.5 : 1;
    const adjusted = Math.round(90 / (speedMultiplier * saveDataMultiplier));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTimeLeft(adjusted);
  }, []);

  // Animate progress bar with random jumps to simulate activity
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 95) return p;
        const jump = Math.random() * 15 + 5;
        return Math.min(p + jump, 95);
      });
    }, 800);
    return () => clearInterval(interval);
  }, []);

  // Countdown timer (minimum 10 seconds while progress bar still animating)
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (progress >= 90 && t <= 10) return 10; // pause at 10s while finishing up
        return Math.max(10, t - 1);
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [progress]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm font-medium text-foreground">
            Our AI is analyzing this job
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          ~{formatTime(timeLeft)}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Extracting skills, requirements, and matching with your profile…
      </p>
      {/* Progress bar */}
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-gradient-to-r from-primary to-desyn-success transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">Processing</span>
        <span className="text-[10px] font-medium text-primary">{progress}%</span>
      </div>
      <p className="text-[9px] text-muted-foreground italic">Duration varies based on your internet speed</p>

      {stuck && (
        <div className="mt-3 flex flex-col gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-amber-800 dark:text-amber-200">
            {retried
              ? "Re-analyzing… this should finish shortly."
              : "This is taking longer than usual. The analysis may have stalled — you can retry it."}
          </p>
          <button
            onClick={retry}
            disabled={retrying}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-500/25 disabled:opacity-60 dark:text-amber-100"
          >
            {retrying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
            {retrying ? "Retrying…" : "Retry analysis"}
          </button>
        </div>
      )}
    </div>
  );
}
