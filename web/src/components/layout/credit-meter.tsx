"use client";

import { useEffect, useRef, useState } from "react";
import { Coins, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function CreditMeter() {
  const [credits, setCredits] = useState<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchCredits = async () => {
      try {
        const res = await fetch("/api/billing");
        const json = await res.json();
        if (json.data?.credits !== undefined) {
          setCredits(json.data.credits);
        }
      } catch (err) {
        console.error("Failed to fetch credits:", err);
      }
    };

    fetchCredits();
    const interval = setInterval(fetchCredits, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (credits === null) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-1.5 hover:bg-primary/20 transition-colors"
      >
        <Coins className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">{credits.toLocaleString()}</span>
        <ChevronDown className={cn("h-3 w-3 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-lg border border-border bg-card p-4 shadow-lg z-50">
          <p className="text-xs font-semibold text-muted-foreground mb-3">AVAILABLE CREDITS</p>

          <div className="mb-4">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-2xl font-bold">{credits.toLocaleString()}</span>
              <span className="text-xs text-muted-foreground">credits</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary rounded-full h-2 transition-all"
                style={{ width: `${Math.min(credits / 100, 100)}%` }}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
            Credits are deducted when you use premium features. Need more? Upgrade your plan or buy a credit bundle.
          </p>

          <button className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            Upgrade or Buy Credits
          </button>
        </div>
      )}
    </div>
  );
}
