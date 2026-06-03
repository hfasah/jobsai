"use client";

import { useEffect, useState } from "react";
import { Coins } from "lucide-react";
import { cn } from "@/lib/utils";

// Compact token-balance chip. Pass `value` to display a known balance (e.g. the
// figure returned after a spend); otherwise it self-fetches from /api/tokens.
export function TokenBalance({
  value,
  className,
}: {
  value?: number;
  className?: string;
}) {
  const [balance, setBalance] = useState<number | null>(value ?? null);

  useEffect(() => {
    if (value !== undefined) {
      setBalance(value);
      return;
    }
    let active = true;
    fetch("/api/tokens")
      .then((r) => r.json())
      .then((j) => { if (active && j.data) setBalance(j.data.balance); })
      .catch(() => {});
    return () => { active = false; };
  }, [value]);

  const low = balance !== null && balance < 50;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold tabular-nums",
        low
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-border bg-card text-foreground",
        className
      )}
      title="Token balance"
    >
      <Coins className={cn("h-3.5 w-3.5", low ? "text-destructive" : "text-desyn-accent")} />
      {balance === null ? "…" : balance.toLocaleString()}
    </span>
  );
}
