"use client";

import { useEffect, useState } from "react";
import { Loader2, Clock } from "lucide-react";

export function ProcessingPlaceholder() {
  const [progress, setProgress] = useState(15);
  const [timeLeft, setTimeLeft] = useState(90);
  const [bandwidthMultiplier, setBandwidthMultiplier] = useState(1);

  // Measure bandwidth on mount
  useEffect(() => {
    if ("connection" in navigator) {
      const conn = (navigator as any).connection;

      // effectiveType: '4g' | '3g' | '2g' | 'slow-2g'
      // downlink: Mbps
      const effectiveType = conn.effectiveType || "4g";
      const downlink = conn.downlink || 5;

      // Base case: 4g at ~10 Mbps = 1.0x (normal speed)
      // Scale inversely: slower connection = longer time
      const speedMultiplier = Math.max(0.3, downlink / 10);

      // Bonus for save-data mode
      const saveDataMultiplier = conn.saveData ? 1.5 : 1;

      const multiplier = speedMultiplier * saveDataMultiplier;
      setBandwidthMultiplier(multiplier);
    }
  }, []);

  // Adjust initial time based on bandwidth
  useEffect(() => {
    const baseTime = 90; // 1.5 minutes base
    const adjustedTime = Math.round(baseTime / bandwidthMultiplier);
    setTimeLeft(adjustedTime);
  }, [bandwidthMultiplier]);

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

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((t) => Math.max(0, t - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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
    </div>
  );
}
