"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { X, FileText, Settings, User, CheckCircle2, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface OnboardingChecklistProps {
  hasResume?: boolean;
  hasJobPreferences?: boolean;
  hasApplyProfile?: boolean;
}

export function OnboardingChecklist({
  hasResume = false,
  hasJobPreferences = false,
  hasApplyProfile = false,
}: OnboardingChecklistProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Load dismiss state from localStorage
    const dismissedKey = "onboarding-dismissed";
    const wasDismissed = localStorage.getItem(dismissedKey) === "true";
    setDismissed(wasDismissed);
    setIsOpen(!wasDismissed);
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    setIsOpen(false);
    localStorage.setItem("onboarding-dismissed", "true");
  };

  if (!isOpen || dismissed) return null;

  const completed = [hasResume, hasJobPreferences, hasApplyProfile].filter(Boolean).length;
  const total = 3;
  const allComplete = completed === total;

  const items = [
    {
      id: "resume",
      icon: FileText,
      title: "Upload Resume",
      description: "Add at least one resume to get started. You can upload multiple versions for different roles.",
      href: "/dashboard/resumes",
      complete: hasResume,
    },
    {
      id: "preferences",
      icon: Settings,
      title: "Set Job Preferences",
      description: "Tell us your target roles, locations, salary expectations, and auto-apply rules.",
      href: "/dashboard/skills",
      complete: hasJobPreferences,
    },
    {
      id: "profile",
      icon: User,
      title: "Update Apply Profile",
      description: "Add personal info, work authorization, sponsorship needs, and references for applications.",
      href: "/dashboard/apply-profile",
      complete: hasApplyProfile,
    },
  ];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-2xl sm:p-8">
        <button
          onClick={handleDismiss}
          className="absolute right-4 top-4 rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-tight mb-2">Ready to find your next opportunity?</h2>
          <p className="text-muted-foreground">Complete these 3 steps to unlock the full power of JobsAI</p>
        </div>

        {/* Progress bar */}
        <div className="mb-6 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold">{completed} of {total} complete</span>
            {allComplete ? (
              <span className="text-emerald-600 font-semibold">You're all set! 🎉</span>
            ) : (
              <span className="text-muted-foreground">{total - completed} to go</span>
            )}
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-500"
              style={{ width: `${(completed / total) * 100}%` }}
            />
          </div>
        </div>

        {/* Checklist items */}
        <div className="space-y-3 mb-6">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "group block rounded-lg border-2 p-4 transition-all hover:border-primary/50",
                  item.complete
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-border hover:bg-muted/50"
                )}
              >
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    {item.complete ? (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20">
                        <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                      </div>
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold group-hover:text-primary transition-colors">
                        {item.title}
                      </h3>
                      {item.complete && (
                        <span className="text-xs font-medium text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                          Done
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                  {!item.complete && (
                    <div className="flex-shrink-0 flex items-center">
                      <span className="text-xs font-medium text-muted-foreground group-hover:text-primary transition-colors">
                        Start →
                      </span>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-border">
          {allComplete ? (
            <div className="text-center py-2">
              <p className="text-sm text-emerald-600 font-medium">
                ✓ Profile complete! You can now discover jobs, set auto-apply rules, and start your journey.
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Full access to job discovery, auto-apply, and AI interview prep unlocks when all 3 steps are complete.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
