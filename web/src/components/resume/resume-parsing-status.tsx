"use client";

import { useEffect, useState } from "react";
import { Loader2, Clock } from "lucide-react";

export function ResumeParsingStatus() {
  const [progress, setProgress] = useState(10);
  const [timeLeft, setTimeLeft] = useState(120);
  const [bandwidthMultiplier, setBandwidthMultiplier] = useState(1);

  // Measure bandwidth on mount
  useEffect(() => {
    if ("connection" in navigator) {
      const conn = (navigator as any).connection;

      // effectiveType: '4g' | '3g' | '2g' | 'slow-2g'
      // downlink: Mbps (4g ≈ 10 Mbps, 3g ≈ 1.5 Mbps, 2g ≈ 0.4 Mbps)
      const effectiveType = conn.effectiveType || "4g";
      const downlink = conn.downlink || 5; // default to mid-range if not available

      // Base case: 4g at ~10 Mbps = 1.0x (normal speed)
      // 3g at ~1.5 Mbps = 0.15x (slower)
      // 2g at ~0.4 Mbps = 0.04x (much slower)
      const speedMultiplier = Math.max(0.3, downlink / 10);

      // Bonus for save-data mode (users on slow networks opted in)
      const saveDataMultiplier = conn.saveData ? 1.5 : 1;

      const multiplier = speedMultiplier * saveDataMultiplier;
      setBandwidthMultiplier(multiplier);
    }
  }, []);

  // Adjust initial time based on bandwidth
  useEffect(() => {
    const baseTime = 120; // 2 minutes base
    const adjustedTime = Math.round(baseTime / bandwidthMultiplier);
    setTimeLeft(adjustedTime);
  }, [bandwidthMultiplier]);

  // Animate progress with random jumps
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 90) return p;
        const jump = Math.random() * 12 + 3;
        return Math.min(p + jump, 90);
      });
    }, 600);
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
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin text-primary" />
          <span className="text-xs font-medium text-foreground">Analyzing resume</span>
          <span className="text-[10px] text-muted-foreground">{progress}%</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock className="h-2.5 w-2.5" />
          <span>~{formatTime(timeLeft)}</span>
        </div>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-gradient-to-r from-primary to-green-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-[9px] text-muted-foreground italic">Duration varies based on your internet speed</p>
    </div>
  );
}
