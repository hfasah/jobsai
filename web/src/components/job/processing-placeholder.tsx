"use client";

import { useEffect, useState } from "react";
import { Loader2, Zap } from "lucide-react";

export function ProcessingPlaceholder() {
  const [progress, setProgress] = useState(15);

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

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="text-sm font-medium text-foreground">
          Our AI is analyzing this job
        </span>
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
    </div>
  );
}
