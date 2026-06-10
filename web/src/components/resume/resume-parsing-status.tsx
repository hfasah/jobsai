"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

export function ResumeParsingStatus() {
  const [progress, setProgress] = useState(10);

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

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Loader2 className="h-3 w-3 animate-spin text-primary" />
        <span className="text-xs font-medium text-foreground">Analyzing resume</span>
        <span className="text-[10px] text-muted-foreground">{progress}%</span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-gradient-to-r from-primary to-green-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
